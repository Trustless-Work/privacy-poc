/** Build a delegated transfer that exhausts the private escrow allowance. */

import type { KeyPair } from "../crypto/keys.js";
import { H, commit, ecdh, pointFromX, scalarMul, type Point } from "../crypto/grumpkin.js";
import { frAdd, frMod, randomScalar } from "../crypto/field.js";
import { DOMAIN } from "../crypto/constants.js";
import {
  deriveAllowR,
  deriveEphemeralRE,
  deriveTxBlind,
  decryptAllowance,
  encryptAllowance,
  encryptAmount,
  poseidonWithDomain,
  spongeSqueeze2,
} from "../crypto/poseidon2.js";
import { fieldIn, pointIn, type NoirInputs } from "./common.js";

export interface FullReleaseParams {
  /** Confidential keys registered for the escrow contract address. */
  spenderKeys: KeyPair;
  /** Decrypted delegation viewing key. */
  dvk: bigint;
  /** Current private allowance opening. */
  allowance: bigint;
  allowanceSalt: bigint;
  /** Receiver's registered public viewing key. */
  recipientViewingKey: Point;
  recipientAuditorKey: Point;
  ownerAuditorKey: Point;
  nextAllowanceSalt?: bigint;
  rE?: bigint;
}

export interface FullReleaseWitness {
  inputs: NoirInputs;
  payload: {
    cANew: Point;
    cTx: Point;
    rE: Point;
    vTilde: bigint;
    aTildeNew: bigint;
    sigmaANew: bigint;
    vAudR: bigint;
    rAudR: bigint;
    vAudS: bigint;
    aAudS: bigint;
  };
  recipientView: { amount: bigint; rTx: bigint; cTx: Point };
  nextDelegation: { v: 0n; r: bigint; sigmaA: bigint; cA: Point };
}

/**
 * Recovers `dvk` from the SetSpender event and stored escrow handoff.
 * The event's full `R_e` point is required because storage retains only R_e.x.
 */
export function decryptEscrowedDvk(
  spenderKeys: KeyPair,
  spenderAddressField: bigint,
  eventRE: Point,
  escrowedDvk: { rX: bigint; cipher: bigint },
): bigint {
  if (eventRE.toAffine().x !== escrowedDvk.rX) {
    throw new Error("SetSpender event does not match delegation handoff");
  }
  const sharedX = ecdh(spenderKeys.sk, eventRE);
  const mask = poseidonWithDomain(DOMAIN.ESCROWED_DELEGATION_VIEWING_KEY, [
    sharedX,
    spenderAddressField,
  ]);
  return frMod(escrowedDvk.cipher - mask);
}

export interface StoredDelegation {
  allowanceCommitment: Point;
  encryptedAllowance: bigint;
  escrowedDvk: { rX: bigint; cipher: bigint };
  allowanceSalt: bigint;
}

/** Recover and commitment-check the private allowance directly from storage. */
export function openStoredDelegation(
  spenderKeys: KeyPair,
  spenderAddressField: bigint,
  delegation: StoredDelegation,
): { dvk: bigint; allowance: bigint; allowanceSalt: bigint } {
  const rE = pointFromX(delegation.escrowedDvk.rX);
  const dvk = decryptEscrowedDvk(
    spenderKeys,
    spenderAddressField,
    rE,
    delegation.escrowedDvk,
  );
  const allowance = decryptAllowance(
    delegation.encryptedAllowance,
    dvk,
    delegation.allowanceSalt,
  );
  const rA = deriveAllowR(dvk, delegation.allowanceSalt);
  if (!commit(allowance, rA).equals(delegation.allowanceCommitment)) {
    throw new Error("decrypted allowance does not match on-chain commitment");
  }
  return { dvk, allowance, allowanceSalt: delegation.allowanceSalt };
}

export function buildFullReleaseWitness(p: FullReleaseParams): FullReleaseWitness {
  if (p.allowance <= 0n) throw new Error("allowance must be greater than zero");

  const rA = deriveAllowR(p.dvk, p.allowanceSalt);
  const cA = commit(p.allowance, rA);
  let sigmaANew = p.nextAllowanceSalt ?? randomScalar();
  while (sigmaANew === p.allowanceSalt) sigmaANew = randomScalar();

  // Full release is not a caller-selected amount: the transfer value is the
  // complete live allowance and the post-transfer plaintext is fixed to zero.
  const amount = p.allowance;
  const nextAllowance = 0n;
  const rANew = deriveAllowR(p.dvk, sigmaANew);
  const cANew = commit(nextAllowance, rANew);
  const aTildeNew = encryptAllowance(nextAllowance, p.dvk, sigmaANew);

  const rE = p.rE ?? deriveEphemeralRE(p.spenderKeys.vk, p.allowanceSalt);
  const rEPoint = scalarMul(rE, H);
  const recipientSharedX = ecdh(rE, p.recipientViewingKey);
  const rTx = deriveTxBlind(recipientSharedX, p.allowanceSalt);
  const cTx = commit(amount, rTx);
  const vTilde = encryptAmount(amount, recipientSharedX, p.allowanceSalt);

  const recipientAuditorSharedX = ecdh(rE, p.recipientAuditorKey);
  const recipientMasks = spongeSqueeze2(
    DOMAIN.AUDITOR_RECIPIENT,
    recipientAuditorSharedX,
    p.allowanceSalt,
  );
  const vAudR = frAdd(amount, recipientMasks[0]);
  const rAudR = frAdd(rTx, recipientMasks[1]);

  const ownerAuditorSharedX = ecdh(rE, p.ownerAuditorKey);
  const ownerMasks = spongeSqueeze2(
    DOMAIN.AUDITOR_SENDER,
    ownerAuditorSharedX,
    p.allowanceSalt,
  );
  const vAudS = frAdd(amount, ownerMasks[0]);
  const aAudS = frAdd(nextAllowance, ownerMasks[1]);

  const inputs: NoirInputs = {
    sk_op: fieldIn(p.spenderKeys.sk),
    dvk_i: fieldIn(p.dvk),
    v_a: fieldIn(p.allowance),
    r_a: fieldIn(rA),
    v_tx: fieldIn(amount),
    r_e: fieldIn(rE),
    ...pointIn("c_a", cA),
    sigma_a: fieldIn(p.allowanceSalt),
    ...pointIn("y_op", p.spenderKeys.Y),
    ...pointIn("pvk_recipient", p.recipientViewingKey),
    ...pointIn("k_aud_r", p.recipientAuditorKey),
    ...pointIn("k_aud_s", p.ownerAuditorKey),
    ...pointIn("c_a_new", cANew),
    ...pointIn("c_tx", cTx),
    ...pointIn("r_e", rEPoint),
    v_tilde: fieldIn(vTilde),
    a_tilde_new: fieldIn(aTildeNew),
    sigma_a_new: fieldIn(sigmaANew),
    v_tilde_aud_r: fieldIn(vAudR),
    r_tilde_aud_r: fieldIn(rAudR),
    v_tilde_aud_s: fieldIn(vAudS),
    a_tilde_aud_s: fieldIn(aAudS),
  };

  return {
    inputs,
    payload: {
      cANew,
      cTx,
      rE: rEPoint,
      vTilde,
      aTildeNew,
      sigmaANew,
      vAudR,
      rAudR,
      vAudS,
      aAudS,
    },
    recipientView: { amount, rTx, cTx },
    nextDelegation: { v: 0n, r: rANew, sigmaA: sigmaANew, cA: cANew },
  };
}
