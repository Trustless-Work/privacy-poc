// Regression: escrow releases are `spender_transfer` events, not ordinary
// `transfer` events. A v1 browser cache may already have advanced beyond the
// release, so v2 must backfill it once and reconstruct the exact C_tx opening.
import { buildConfidentialEvent, KNOWN } from "../src/chain/events.ts";
import { StateEngine } from "../src/state/engine.ts";
import { MemoryStore } from "../src/state/store.ts";
import { deriveKeys } from "../src/crypto/keys.ts";
import { H, commit, scalarMul } from "../src/crypto/grumpkin.ts";
import { buildFullReleaseWitness } from "../src/witness/spender-transfer.ts";
import { auditSpenderTransfer } from "../src/auditor/decrypt.ts";

let pass = 0, fail = 0;
const check = (name, condition) => {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
};

const payer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const receiver = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBF3W";
const spender = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const addrF = 1234n;
const receiverKeys = deriveKeys(2222n, addrF);
const spenderKeys = deriveKeys(3333n, addrF);
const auditorSecret = 4444n;
const auditorKey = scalarMul(auditorSecret, H);
const allowance = 1_000_000n;
const allowanceSalt = 5555n;
const release = buildFullReleaseWitness({
  spenderKeys,
  dvk: 6666n,
  allowance,
  allowanceSalt,
  recipientViewingKey: receiverKeys.PVK,
  recipientAuditorKey: auditorKey,
  ownerAuditorKey: auditorKey,
  nextAllowanceSalt: 7777n,
  rE: 8888n,
});

const fields = {
  r_e: release.payload.rE,
  v_tilde: release.payload.vTilde,
  sigma_a: allowanceSalt,
  v_aud_r: release.payload.vAudR,
  r_aud_r: release.payload.rAudR,
  v_aud_s: release.payload.vAudS,
  a_aud_s: release.payload.aAudS,
};
const data = {
  field: (name) => fields[name],
  point: (name) => fields[name],
  i128: () => { throw new Error("unexpected i128"); },
  u32: () => { throw new Error("unexpected u32"); },
};
const addresses = ["spender_transfer", spender, payer, receiver];
const event = buildConfidentialEvent(
  "spender_transfer",
  { ledger: 50, txHash: "release-tx", cursor: "release-event" },
  (i) => addresses[i],
  data,
);

check("spender_transfer is a known token event", KNOWN.has("spender_transfer"));
check("decoder recognizes spender_transfer", event?.type === "spender_transfer");
check("decoder maps spender topic", event?.spender === spender);
check("decoder maps payer and receiver topics", event?.from === payer && event?.to === receiver);
check("decoder reads the original allowance salt", event?.sigmaA === allowanceSalt);

const store = new MemoryStore();
await store.save({
  address: receiver,
  spendable: { v: 0n, r: 0n },
  receiving: { v: 0n, r: 0n },
  registered: true,
  cursor: `${200n << 32n}-0`,
  syncedLedger: 200,
  // Deliberately no cacheVersion: this is a v1 cache that skipped the release.
});

let indexerCalls = 0;
const indexer = {
  fetchEvents: async () => {
    indexerCalls++;
    return { events: [event], cursor: undefined, latestLedger: 99 };
  },
};
const client = {
  cfg: { contracts: { token: "CTOKEN" } },
  server: {
    getHealth: async () => ({ oldestLedger: 100, latestLedger: 250 }),
    getEvents: async () => ({ events: [], cursor: undefined, latestLedger: 250 }),
  },
};
const engine = new StateEngine({
  client,
  store,
  keys: receiverKeys,
  address: receiver,
  fromLedger: 1,
  indexer,
});

const recovered = await engine.sync();
check("v1 cache upgrades to version 2", recovered.cacheVersion === 2);
check("historical release credits Receiver exactly once", recovered.receiving.v === allowance);
check(
  "recovered opening matches the release commitment",
  commit(recovered.receiving.v, recovered.receiving.r).equals(release.payload.cTx),
);

const audited = auditSpenderTransfer(auditorSecret, event);
check("auditor decrypts the release amount", audited.channelsAgree && audited.amount === allowance);

const syncedAgain = await engine.sync();
check(
  "later sync does not double-credit the historical release",
  syncedAgain.receiving.v === allowance && indexerCalls === 1,
);

console.log(`\nrelease-recovery: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
