import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";

import { DOMAIN } from "../src/crypto/constants.ts";
import { frAdd, randomScalar } from "../src/crypto/field.ts";
import { G, H, commit, ecdh, scalarMul } from "../src/crypto/grumpkin.ts";
import { deriveKeys } from "../src/crypto/keys.ts";
import {
  deriveAllowR,
  deriveEphemeralRE,
  deriveTxBlind,
  encryptAllowance,
  encryptAmount,
  spongeSqueeze2,
} from "../src/crypto/poseidon2.ts";
import { fieldIn, pointIn } from "../src/witness/common.ts";
import { buildSetSpenderWitness } from "../src/witness/set-spender.ts";
import { buildFullReleaseWitness } from "../src/witness/spender-transfer.ts";

const releaseArtifact = JSON.parse(
  readFileSync(new URL("../circuits/spender_transfer_full_release.json", import.meta.url), "utf8"),
);
const setSpenderArtifact = JSON.parse(
  readFileSync(new URL("../circuits/set_spender.json", import.meta.url), "utf8"),
);
const circuit = new Noir(releaseArtifact);
const setSpenderCircuit = new Noir(setSpenderArtifact);
const addrF = randomScalar();
const payer = deriveKeys(randomScalar(), addrF);
const spender = deriveKeys(randomScalar(), addrF);
const receiver = deriveKeys(randomScalar(), addrF);
const auditorKey = () => scalarMul(randomScalar(), G);
const recipientAuditor = auditorKey();
const ownerAuditor = auditorKey();
const dvk = randomScalar();
const allowance = 1_000n;
const allowanceSalt = randomScalar();

let pass = 0;
let fail = 0;
async function expectOk(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    fail++;
    console.error(`  ✗ ${name}: ${String(error)}`);
  }
}
async function expectReject(name, fn) {
  try {
    await fn();
    fail++;
    console.error(`  ✗ ${name} (unexpectedly accepted)`);
  } catch {
    pass++;
    console.log(`  ✓ ${name}`);
  }
}

const funding = buildSetSpenderWitness({
  keys: payer,
  v: 2_000n,
  r: 0n,
  allowance,
  spenderAddressField: randomScalar(),
  spenderSpendingKey: spender.Y,
  ownerAuditorKey: ownerAuditor,
});
await expectOk("escrow funding satisfies the pinned SetSpender circuit", () =>
  setSpenderCircuit.execute(funding.inputs),
);

const full = buildFullReleaseWitness({
  spenderKeys: spender,
  dvk,
  allowance,
  allowanceSalt,
  recipientViewingKey: receiver.PVK,
  recipientAuditorKey: recipientAuditor,
  ownerAuditorKey: ownerAuditor,
});

await expectOk("complete allowance release satisfies the circuit", () => circuit.execute(full.inputs));

function buildInternallyConsistentPartialTransfer(amount) {
  const rA = deriveAllowR(dvk, allowanceSalt);
  const cA = commit(allowance, rA);
  let sigmaANew = randomScalar();
  while (sigmaANew === allowanceSalt) sigmaANew = randomScalar();
  const remaining = allowance - amount;
  const rANew = deriveAllowR(dvk, sigmaANew);
  const cANew = commit(remaining, rANew);
  const aTildeNew = encryptAllowance(remaining, dvk, sigmaANew);
  const rE = deriveEphemeralRE(spender.vk, allowanceSalt);
  const rEPoint = scalarMul(rE, H);
  const recipientShared = ecdh(rE, receiver.PVK);
  const rTx = deriveTxBlind(recipientShared, allowanceSalt);
  const cTx = commit(amount, rTx);
  const vTilde = encryptAmount(amount, recipientShared, allowanceSalt);
  const recipientMasks = spongeSqueeze2(
    DOMAIN.AUDITOR_RECIPIENT,
    ecdh(rE, recipientAuditor),
    allowanceSalt,
  );
  const ownerMasks = spongeSqueeze2(
    DOMAIN.AUDITOR_SENDER,
    ecdh(rE, ownerAuditor),
    allowanceSalt,
  );

  return {
    sk_op: fieldIn(spender.sk),
    dvk_i: fieldIn(dvk),
    v_a: fieldIn(allowance),
    r_a: fieldIn(rA),
    v_tx: fieldIn(amount),
    r_e: fieldIn(rE),
    ...pointIn("c_a", cA),
    sigma_a: fieldIn(allowanceSalt),
    ...pointIn("y_op", spender.Y),
    ...pointIn("pvk_recipient", receiver.PVK),
    ...pointIn("k_aud_r", recipientAuditor),
    ...pointIn("k_aud_s", ownerAuditor),
    ...pointIn("c_a_new", cANew),
    ...pointIn("c_tx", cTx),
    ...pointIn("r_e", rEPoint),
    v_tilde: fieldIn(vTilde),
    a_tilde_new: fieldIn(aTildeNew),
    sigma_a_new: fieldIn(sigmaANew),
    v_tilde_aud_r: fieldIn(frAdd(amount, recipientMasks[0])),
    r_tilde_aud_r: fieldIn(frAdd(rTx, recipientMasks[1])),
    v_tilde_aud_s: fieldIn(frAdd(amount, ownerMasks[0])),
    a_tilde_aud_s: fieldIn(frAdd(remaining, ownerMasks[1])),
  };
}

await expectReject("internally consistent partial release is rejected", () =>
  circuit.execute(buildInternallyConsistentPartialTransfer(400n)),
);

console.log(`\nfull-release-circuit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
