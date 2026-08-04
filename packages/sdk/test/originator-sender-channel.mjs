import {
  H,
  addressToField,
  buildSetSpenderWitness,
  decryptTransferSenderAmountAsOriginator,
  deriveKeys,
  randomScalar,
  scalarMul,
} from "../src/index.ts";

const TOKEN = "CBF64DEOVQAXJFBSNGFEUT2AH4H7K5JBY3ZYJ5GVEINMNSDISWRG5N3F";
const keys = deriveKeys(randomScalar(), addressToField(TOKEN));
const auditorSecret = randomScalar();
const auditorPublicKey = scalarMul(auditorSecret, H);
const amount = 550_0000000n;
const rEScalar = randomScalar();
const witness = buildSetSpenderWitness({
  keys,
  v: 750_0000000n,
  r: randomScalar(),
  allowance: amount,
  spenderAddressField: 1234n,
  spenderSpendingKey: scalarMul(randomScalar(), H),
  ownerAuditorKey: auditorPublicKey,
  rE: rEScalar,
});

const disclosed = decryptTransferSenderAmountAsOriginator(
  rEScalar,
  auditorPublicKey,
  {
    sigma: witness.payload.sigma,
    vAudS: witness.payload.vAudS,
  },
);

console.log("Originator sender-channel disclosure:");
console.log(`  ${disclosed === amount ? "✓" : "✗"} decrypts set-spender amount without prior balance history`);
process.exit(disclosed === amount ? 0 : 1);
