import { addressToField } from "../src/crypto/address.ts";
import { randomScalar } from "../src/crypto/field.ts";
import { G, pointCoords, scalarMul } from "../src/crypto/grumpkin.ts";
import { deriveKeys } from "../src/crypto/keys.ts";
import { buildSetSpenderWitness } from "../src/witness/set-spender.ts";
import {
  buildFullReleaseWitness,
  decryptEscrowedDvk,
  openStoredDelegation,
} from "../src/witness/spender-transfer.ts";

const TOKEN = "CCREDIB3DG3IBVUKBL7QMEK4MTPSTODR7MQ34QY4SQ5LZ5L4WFWNVNXG";
const ESCROW = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const addrF = addressToField(TOKEN);
const opI = addressToField(ESCROW);
const payer = deriveKeys(randomScalar(), addrF);
const spender = deriveKeys(randomScalar(), addrF);
const receiver = deriveKeys(randomScalar(), addrF);
const auditorKey = () => scalarMul(randomScalar(), G);

let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

const funding = buildSetSpenderWitness({
  keys: payer,
  v: 1_000_000_000n,
  r: 0n,
  allowance: 250_000_000n,
  spenderAddressField: opI,
  spenderSpendingKey: spender.Y,
  ownerAuditorKey: auditorKey(),
});

check("funding subtracts the allowance from spendable", funding.next.v === 750_000_000n);
check("delegation stores the complete private amount", funding.delegation.v === 250_000_000n);

const recoveredDvk = decryptEscrowedDvk(
  spender,
  opI,
  funding.payload.rE,
  funding.payload.escrowedDvk,
);
check("spender decrypts the delegated viewing key", recoveredDvk === funding.delegation.dvk);

const opened = openStoredDelegation(spender, opI, {
  allowanceCommitment: funding.delegation.cA,
  encryptedAllowance: funding.payload.aTilde,
  escrowedDvk: funding.payload.escrowedDvk,
  allowanceSalt: funding.delegation.sigmaA,
});
check("spender recovers allowance from on-chain delegation fields", opened.allowance === 250_000_000n);
check("recovered allowance is commitment-checked", opened.dvk === funding.delegation.dvk);

const release = buildFullReleaseWitness({
  spenderKeys: spender,
  dvk: recoveredDvk,
  allowance: funding.delegation.v,
  allowanceSalt: funding.delegation.sigmaA,
  recipientViewingKey: receiver.PVK,
  recipientAuditorKey: auditorKey(),
  ownerAuditorKey: auditorKey(),
});

check("release amount equals complete allowance", release.recipientView.amount === 250_000_000n);
check("post-release allowance plaintext is zero", release.nextDelegation.v === 0n);
const nextCommitment = pointCoords(release.nextDelegation.cA);
const payloadCommitment = pointCoords(release.payload.cANew);
check(
  "payload carries the zero-allowance commitment",
  nextCommitment.x === payloadCommitment.x && nextCommitment.y === payloadCommitment.y,
);
check("witness fixes v_tx to v_a", release.inputs.v_tx === release.inputs.v_a);

let rejected = false;
try {
  buildSetSpenderWitness({
    keys: payer,
    v: 10n,
    r: 0n,
    allowance: 11n,
    spenderAddressField: opI,
    spenderSpendingKey: spender.Y,
    ownerAuditorKey: auditorKey(),
  });
} catch {
  rejected = true;
}
check("funding rejects allowance above spendable", rejected);

rejected = false;
try {
  buildSetSpenderWitness({
    keys: payer,
    v: 10n,
    r: 0n,
    allowance: 0n,
    spenderAddressField: opI,
    spenderSpendingKey: spender.Y,
    ownerAuditorKey: auditorKey(),
  });
} catch {
  rejected = true;
}
check("funding rejects a zero-value escrow", rejected);

console.log(`\nescrow-witness: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
