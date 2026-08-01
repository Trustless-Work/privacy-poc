/**
 * Soroban RPC client: read-only simulation, full invoke (build → simulate →
 * assemble → sign → send → poll), and typed reads of confidential state.
 *
 * No indexer. State that the protocol exposes only through events is read with
 * the RPC `getEvents` API (see `events.ts`), accepting its ~7-day retention
 * window — the central trade-off of this demo.
 */

import {
  xdr,
  Address,
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  rpc,
} from "@stellar/stellar-sdk";

import { fromBytesBE } from "../crypto/field.js";
import { pointFromBytes, type Point } from "../crypto/grumpkin.js";

/** Source used for read-only simulation; never signs, never pays. */
const NULL_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

/**
 * Minimal transaction signer. A Node script wraps a {@link Keypair} via
 * {@link keypairSigner}; the web app wraps Freighter's `signTransaction`.
 */
export interface Signer {
  /** G-address of the signer (transaction source / auth principal). */
  publicKey: string;
  /** Sign an assembled transaction (base64 XDR) and return signed base64 XDR. */
  sign(txXdrBase64: string): Promise<string>;
}

export interface ContractIds {
  token: string;
  verifier: string;
  auditor: string;
}

export interface ChainConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contracts: ContractIds;
}

export interface InvokeResult {
  hash: string;
  status: string;
  /** Return value of the invoked function (if any). */
  returnValue?: xdr.ScVal;
}

/** On-chain confidential account (`confidential_balance` return value). */
export interface OnChainAccount {
  spendingKey: Point;
  viewingPublicKey: Point;
  spendableBalance: Point;
  receivingBalance: Point;
  auditorId: number;
}

/** On-chain `(owner, spender)` confidential allowance. */
export interface OnChainDelegation {
  allowanceCommitment: Point;
  encryptedAllowance: bigint;
  /** Compact `(R_e.x, encrypted dvk)` pair; it is not a curve point. */
  escrowedDvk: { rX: bigint; cipher: bigint };
  allowanceSalt: bigint;
  liveUntilLedger: number;
}

export type EscrowStatus = "Initialized" | "Funded" | "Released";

/** Public state of the singleton one-milestone escrow contract. */
export interface OnChainEscrow {
  payer: string;
  receiver: string;
  approver: string;
  confidentialToken: string;
  status: EscrowStatus;
}

export function keypairSigner(secret: string, networkPassphrase: string): Signer {
  const kp = Keypair.fromSecret(secret);
  return {
    publicKey: kp.publicKey(),
    async sign(txXdrBase64: string): Promise<string> {
      const tx = TransactionBuilder.fromXDR(txXdrBase64, networkPassphrase);
      tx.sign(kp);
      return tx.toXDR();
    },
  };
}

export class ChainClient {
  readonly server: rpc.Server;

  constructor(readonly cfg: ChainConfig) {
    this.server = new rpc.Server(cfg.rpcUrl, {
      allowHttp: cfg.rpcUrl.startsWith("http://"),
    });
  }

  // ----- reads -------------------------------------------------------------

  /** Simulate a read-only call and return its raw `ScVal` result. */
  async simulate(contractId: string, method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
    const account = await this.server
      .getAccount(NULL_ACCOUNT)
      .catch(() => new Account(NULL_ACCOUNT, "0"));
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.cfg.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`simulate ${method} failed: ${sim.error}`);
    }
    const ok = sim as rpc.Api.SimulateTransactionSuccessResponse;
    if (!ok.result) throw new Error(`simulate ${method}: no result`);
    return ok.result.retval;
  }

  /** Read a confidential account, or `null` if `address` is not registered. */
  async confidentialBalance(address: string): Promise<OnChainAccount | null> {
    try {
      const retval = await this.simulate(this.cfg.contracts.token, "confidential_balance", [
        new Address(address).toScVal(),
      ]);
      return parseAccount(retval);
    } catch {
      return null;
    }
  }

  async isRegistered(address: string): Promise<boolean> {
    return (await this.confidentialBalance(address)) !== null;
  }

  /** Read a delegation, including expired entries, or null when absent. */
  async spenderDelegation(owner: string, spender: string): Promise<OnChainDelegation | null> {
    try {
      const retval = await this.simulate(this.cfg.contracts.token, "get_spender_delegation", [
        new Address(owner).toScVal(),
        new Address(spender).toScVal(),
      ]);
      return parseDelegation(retval);
    } catch {
      return null;
    }
  }

  /** Read the singleton escrow, or `null` before its one-time initialization. */
  async escrowState(escrowContract: string): Promise<OnChainEscrow | null> {
    try {
      return parseEscrow(await this.simulate(escrowContract, "get_escrow", []));
    } catch {
      return null;
    }
  }

  /** Fetch auditor key `K_aud` (BytesN<64>) for an `auditor_id`. */
  async auditorKey(auditorId: number): Promise<Point> {
    const retval = await this.simulate(this.cfg.contracts.auditor, "get_key", [
      xdr.ScVal.scvU32(auditorId),
    ]);
    return pointFromBytes(new Uint8Array(retval.bytes()));
  }

  async latestLedger(): Promise<number> {
    return (await this.server.getHealth()).latestLedger;
  }

  // ----- writes ------------------------------------------------------------

  /**
   * Build, simulate, assemble, sign, submit, and poll a contract invocation.
   * Auth is taken from simulation; for these demo ops the source account is the
   * sole auth principal, so a single signature suffices.
   */
  async invoke(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    signer: Signer,
  ): Promise<InvokeResult> {
    const source = await this.server.getAccount(signer.publicKey);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.cfg.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(180)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`simulate ${method} failed: ${sim.error}`);
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();

    const signedXdr = await signer.sign(assembled.toXDR());
    const signedTx = TransactionBuilder.fromXDR(signedXdr, this.cfg.networkPassphrase);

    const send = await this.server.sendTransaction(signedTx);
    if (send.status === "ERROR") {
      throw new Error(`send ${method} rejected: ${JSON.stringify(send.errorResult)}`);
    }

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const res = await this.server.getTransaction(send.hash);
      if (res.status === rpc.Api.GetTransactionStatus.NOT_FOUND) continue;
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`${method} failed on-chain (tx ${send.hash})`);
      }
      return { hash: send.hash, status: res.status, returnValue: res.returnValue };
    }
    throw new Error(`${method} confirmation timed out (tx ${send.hash})`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseAccount(val: xdr.ScVal): OnChainAccount {
  const entries = val.map();
  if (!entries) throw new Error("expected ScMap for ConfidentialAccount");
  const out: Partial<OnChainAccount> = {};
  for (const e of entries) {
    const key = e.key().sym().toString();
    switch (key) {
      case "spending_key":
        out.spendingKey = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "viewing_public_key":
        out.viewingPublicKey = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "spendable_balance":
        out.spendableBalance = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "receiving_balance":
        out.receivingBalance = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "auditor_id":
        out.auditorId = e.val().u32();
        break;
    }
  }
  return out as OnChainAccount;
}

function parseDelegation(val: xdr.ScVal): OnChainDelegation {
  const entries = val.map();
  if (!entries) throw new Error("expected ScMap for SpenderDelegation");
  const out: Partial<OnChainDelegation> = {};
  for (const e of entries) {
    const key = e.key().sym().toString();
    const bytes = () => new Uint8Array(e.val().bytes());
    switch (key) {
      case "allowance_commitment":
        out.allowanceCommitment = pointFromBytes(bytes());
        break;
      case "encrypted_allowance":
        out.encryptedAllowance = fromBytesBE(bytes());
        break;
      case "escrowed_dvk": {
        const pair = bytes();
        if (pair.length !== 64) throw new Error("invalid escrowed_dvk length");
        out.escrowedDvk = {
          rX: fromBytesBE(pair.subarray(0, 32)),
          cipher: fromBytesBE(pair.subarray(32, 64)),
        };
        break;
      }
      case "allowance_salt":
        out.allowanceSalt = fromBytesBE(bytes());
        break;
      case "live_until_ledger":
        out.liveUntilLedger = e.val().u32();
        break;
    }
  }
  if (
    !out.allowanceCommitment || out.encryptedAllowance === undefined ||
    !out.escrowedDvk || out.allowanceSalt === undefined ||
    out.liveUntilLedger === undefined
  ) {
    throw new Error("incomplete SpenderDelegation response");
  }
  return out as OnChainDelegation;
}

function parseEscrow(val: xdr.ScVal): OnChainEscrow {
  const entries = val.map();
  if (!entries) throw new Error("expected ScMap for Escrow");
  const out: Partial<OnChainEscrow> = {};
  for (const e of entries) {
    const key = e.key().sym().toString();
    switch (key) {
      case "payer":
        out.payer = Address.fromScVal(e.val()).toString();
        break;
      case "receiver":
        out.receiver = Address.fromScVal(e.val()).toString();
        break;
      case "approver":
        out.approver = Address.fromScVal(e.val()).toString();
        break;
      case "confidential_token":
        out.confidentialToken = Address.fromScVal(e.val()).toString();
        break;
      case "status": {
        const tag = e.val().vec()?.[0]?.sym().toString();
        if (tag !== "Initialized" && tag !== "Funded" && tag !== "Released") {
          throw new Error(`unknown escrow status: ${tag ?? "missing"}`);
        }
        out.status = tag;
        break;
      }
    }
  }
  if (!out.payer || !out.receiver || !out.approver || !out.confidentialToken || !out.status) {
    throw new Error("incomplete Escrow response");
  }
  return out as OnChainEscrow;
}
