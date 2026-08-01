/** Build the upstream SetSpender witness used to fund the escrow privately. */

import type { KeyPair } from "../crypto/keys.js";
import { H, commit, ecdh, scalarMul, type Point } from "../crypto/grumpkin.js";
import { frAdd, randomScalar } from "../crypto/field.js";
import { DOMAIN } from "../crypto/constants.js";
import {
  deriveAllowR,
  deriveEphemeralRE,
  deriveSpendR,
  dvkFromVkOp,
  encryptAllowance,
  encryptBalance,
  encryptEscDvk,
  spongeSqueeze2,
} from "../crypto/poseidon2.js";
import { fieldIn, pointIn, type NoirInputs } from "./common.js";

export interface SetSpenderParams {
  /** Payer's contract-bound confidential-token keys. */
  keys: KeyPair;
  /** Payer's current spendable opening. */
  v: bigint;
  r: bigint;
  /** Complete private escrow amount. */
  allowance: bigint;
  /** `addressToField(escrowContractAddress)`. */
  spenderAddressField: bigint;
  /** Escrow contract's registered confidential spending public key. */
  spenderSpendingKey: Point;
  /** Payer-side auditor public key. */
  ownerAuditorKey: Point;
  sigma?: bigint;
  allowanceSalt?: bigint;
  rE?: bigint;
}

export interface SetSpenderWitness {
  inputs: NoirInputs;
  payload: {
    cSpendNew: Point;
    cA: Point;
    escrowedDvk: { rX: bigint; cipher: bigint };
    bTilde: bigint;
    aTilde: bigint;
    rE: Point;
    sigma: bigint;
    sigmaA: bigint;
    vAudS: bigint;
    bAudS: bigint;
  };
  next: { v: bigint; r: bigint; cSpend: Point };
  delegation: { dvk: bigint; v: bigint; r: bigint; sigmaA: bigint; cA: Point };
}

export function buildSetSpenderWitness(p: SetSpenderParams): SetSpenderWitness {
  if (p.allowance <= 0n) throw new Error("allowance must be greater than zero");
  const vNew = p.v - p.allowance;
  if (vNew < 0n) throw new Error("allowance exceeds spendable balance");

  const sigma = p.sigma ?? randomScalar();
  const sigmaA = p.allowanceSalt ?? randomScalar();
  const rE = p.rE ?? deriveEphemeralRE(p.keys.vk, sigma);
  const rEPoint = scalarMul(rE, H);

  const cSpend = commit(p.v, p.r);
  const rNew = deriveSpendR(p.keys.vk, sigma);
  const cSpendNew = commit(vNew, rNew);
  const bTilde = encryptBalance(vNew, p.keys.vk, sigma);

  const dvk = dvkFromVkOp(p.keys.vk, p.spenderAddressField);
  const rA = deriveAllowR(dvk, sigmaA);
  const cA = commit(p.allowance, rA);
  const aTilde = encryptAllowance(p.allowance, dvk, sigmaA);

  const escrowSharedX = ecdh(rE, p.spenderSpendingKey);
  const escrowedDvkCipher = encryptEscDvk(dvk, escrowSharedX, p.spenderAddressField);
  // The protocol encodes this two-field handoff in Point's 64-byte container,
  // but `(R_e.x, ciphertext)` is not intended to be an elliptic-curve point.
  const escrowedDvk = {
    rX: rEPoint.toAffine().x,
    cipher: escrowedDvkCipher,
  };

  const ownerAuditorSharedX = ecdh(rE, p.ownerAuditorKey);
  const ownerMasks = spongeSqueeze2(DOMAIN.AUDITOR_SENDER, ownerAuditorSharedX, sigma);
  const vAudS = frAdd(p.allowance, ownerMasks[0]);
  const bAudS = frAdd(vNew, ownerMasks[1]);

  const inputs: NoirInputs = {
    sk: fieldIn(p.keys.sk),
    v: fieldIn(p.v),
    r: fieldIn(p.r),
    v_a: fieldIn(p.allowance),
    r_e: fieldIn(rE),
    ...pointIn("c_spend", cSpend),
    ...pointIn("y", p.keys.Y),
    ...pointIn("y_op", p.spenderSpendingKey),
    op_i: fieldIn(p.spenderAddressField),
    addr_f: fieldIn(p.keys.addrF),
    ...pointIn("k_aud_s", p.ownerAuditorKey),
    ...pointIn("c_spend_new", cSpendNew),
    ...pointIn("c_a", cA),
    escrowed_dvk_r_x: fieldIn(escrowedDvk.rX),
    escrowed_dvk_cipher: fieldIn(escrowedDvk.cipher),
    b_tilde: fieldIn(bTilde),
    a_tilde: fieldIn(aTilde),
    sigma: fieldIn(sigma),
    sigma_a: fieldIn(sigmaA),
    ...pointIn("r_e", rEPoint),
    v_tilde_aud_s: fieldIn(vAudS),
    b_tilde_aud_s: fieldIn(bAudS),
  };

  return {
    inputs,
    payload: {
      cSpendNew,
      cA,
      escrowedDvk,
      bTilde,
      aTilde,
      rE: rEPoint,
      sigma,
      sigmaA,
      vAudS,
      bAudS,
    },
    next: { v: vNew, r: rNew, cSpend: cSpendNew },
    delegation: { dvk, v: p.allowance, r: rA, sigmaA, cA },
  };
}
