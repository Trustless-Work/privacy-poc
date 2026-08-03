/** Browser orchestration for one selected escrow contract. */

import {
  addressToField,
  buildFullReleaseWitness,
  buildRegisterWitness,
  deriveKeys,
  deployEscrow,
  fromHex,
  openStoredDelegation,
  proverFromArtifact,
  submitApproveAndRelease,
  submitInitializeEscrow,
  toHex32,
  type CircuitProver,
  type KeyPair,
  type OnChainEscrow,
  type Signer,
} from "@ctd/sdk";
import registerCircuit from "@ctd/sdk/circuits/register.json";
import fullReleaseCircuit from "@ctd/sdk/circuits/spender_transfer_full_release.json";

import type { Deployment } from "./deployment";
import { connectFreighter, type MessageSigner } from "./freighter";
import { keyDerivationMessage, skFromSignature } from "./derive-key";
import { ensureBrowserBackend } from "./bb-loader";
import { clientsFor } from "./rpc";
import { truncatePrefix } from "./format";

type Log = (message: string) => void;
export type EscrowTxPhase = "proving" | "submitting";
export type EscrowCreatePhase = "deploying" | EscrowTxPhase;

export class SingletonEscrow {
  readonly address: string;
  readonly approverAddress: string;
  private readonly registerProver: CircuitProver;
  private readonly releaseProver: CircuitProver;

  private constructor(
    private readonly deployment: Deployment,
    private readonly signer: Signer,
    private readonly spenderKeys: KeyPair,
    private readonly log: Log,
  ) {
    const address = deployment.contracts.escrow;
    if (!address) throw new Error("escrow contract is not selected");
    this.address = address;
    this.approverAddress = signer.publicKey;
    this.registerProver = proverFromArtifact(registerCircuit as never);
    this.releaseProver = proverFromArtifact(fullReleaseCircuit as never);
  }

  static async connect(deployment: Deployment, log: Log): Promise<SingletonEscrow> {
    ensureBrowserBackend();
    const escrow = deployment.contracts.escrow;
    if (!escrow) throw new Error("escrow contract is not selected");
    const signer = await connectFreighter();
    log(`connected approver ${truncatePrefix(signer.publicKey, 8)}`);
    return SingletonEscrow.fromSigner(deployment, signer, log);
  }

  /** Deploy and initialize a fresh escrow using only Freighter. */
  static async create(
    deployment: Deployment,
    payer: string,
    receiver: string,
    log: Log,
    onPhase?: (phase: EscrowCreatePhase) => void,
    onDeployed?: (contractId: string) => void,
  ): Promise<SingletonEscrow> {
    ensureBrowserBackend();
    const factory = deployment.contracts.factory;
    if (!factory) throw new Error("escrow factory is not configured");
    const signer = await connectFreighter();
    if (payer === receiver || payer === signer.publicKey || receiver === signer.publicKey) {
      throw new Error("Payer, Receiver, and Approver must be three different Stellar accounts.");
    }
    const { client } = clientsFor(deployment);
    onPhase?.("deploying");
    log("deploying a fresh escrow from the shared factory…");
    const escrow = await deployEscrow(client, signer, factory);
    log(`fresh escrow deployed at ${truncatePrefix(escrow, 8)}`);
    onDeployed?.(escrow);

    const configured: Deployment = {
      ...deployment,
      contracts: { ...deployment.contracts, escrow },
    };
    const controller = await SingletonEscrow.fromSigner(configured, signer, log);
    await controller.initialize(payer, receiver, onPhase);
    return controller;
  }

  private static async fromSigner(deployment: Deployment, signer: MessageSigner, log: Log): Promise<SingletonEscrow> {
    const escrow = deployment.contracts.escrow;
    if (!escrow) throw new Error("escrow contract is not configured");
    const cacheKey = `ctd:escrow-sk:${deployment.contracts.token}:${escrow}:${signer.publicKey}`;
    let sk: bigint;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      sk = fromHex(cached);
    } else {
      log("sign the escrow key-derivation message in Freighter…");
      const signature = await signer.signMessage(
        `${keyDerivationMessage(deployment.networkPassphrase, deployment.contracts.token)}\nEscrow contract: ${escrow}`,
      );
      sk = await skFromSignature(signature);
      localStorage.setItem(cacheKey, toHex32(sk));
    }
    return new SingletonEscrow(
      deployment,
      signer,
      deriveKeys(sk, addressToField(deployment.contracts.token)),
      log,
    );
  }

  async state(): Promise<OnChainEscrow | null> {
    return clientsFor(this.deployment).client.escrowState(this.address);
  }

  async initialize(
    payer: string,
    receiver: string,
    onPhase?: (phase: EscrowTxPhase) => void,
  ): Promise<void> {
    const { client } = clientsFor(this.deployment);
    const witness = buildRegisterWitness(this.spenderKeys);
    onPhase?.("proving");
    this.log("proving registration for the new escrow address…");
    const { proof } = await this.registerProver.prove(witness.inputs);
    onPhase?.("submitting");
    this.log("initializing the escrow with fixed roles…");
    const result = await submitInitializeEscrow(
      client,
      this.signer,
      this.address,
      payer,
      receiver,
      this.approverAddress,
      this.deployment.auditorId,
      witness,
      proof,
    );
    this.log(`escrow initialized (tx ${truncatePrefix(result.hash)})`);
  }

  async approveAndRelease(onPhase?: (phase: EscrowTxPhase) => void): Promise<void> {
    const { client } = clientsFor(this.deployment);
    const escrow = await client.escrowState(this.address);
    if (!escrow) throw new Error("escrow is not initialized");
    if (escrow.approver !== this.approverAddress) {
      throw new Error(`connected wallet is not the configured approver (${escrow.approver})`);
    }
    if (escrow.status !== "Funded") throw new Error(`escrow is ${escrow.status}, not Funded`);

    const delegation = await client.spenderDelegation(escrow.payer, this.address);
    if (!delegation) throw new Error("payer delegation is missing, expired, or revoked");
    const receiver = await client.confidentialBalance(escrow.receiver);
    if (!receiver) throw new Error("receiver is not registered");
    const payer = await client.confidentialBalance(escrow.payer);
    if (!payer) throw new Error("payer is not registered");
    const opened = openStoredDelegation(
      this.spenderKeys,
      addressToField(this.address),
      delegation,
    );
    const witness = buildFullReleaseWitness({
      spenderKeys: this.spenderKeys,
      dvk: opened.dvk,
      allowance: opened.allowance,
      allowanceSalt: opened.allowanceSalt,
      recipientViewingKey: receiver.viewingPublicKey,
      recipientAuditorKey: await client.auditorKey(receiver.auditorId),
      ownerAuditorKey: await client.auditorKey(payer.auditorId),
    });
    onPhase?.("proving");
    this.log("proving that the complete private allowance is released…");
    const { proof } = await this.releaseProver.prove(witness.inputs);
    onPhase?.("submitting");
    this.log("submitting approval and atomic full release…");
    const result = await submitApproveAndRelease(
      client,
      this.signer,
      this.address,
      witness,
      proof,
    );
    this.log(`approved and released in full (tx ${truncatePrefix(result.hash)})`);
  }

  async latestLedger(): Promise<number> {
    return clientsFor(this.deployment).client.latestLedger();
  }

  async destroy(): Promise<void> {
    await Promise.all([this.registerProver.destroy(), this.releaseProver.destroy()]);
  }
}
