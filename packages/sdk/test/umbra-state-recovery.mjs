import {
  H,
  addressToField,
  deriveKeys,
  deriveSpendR,
  encryptBalance,
  commit,
} from "../src/crypto/index.ts";
import { StateEngine } from "../src/state/engine.ts";
import { MemoryStore } from "../src/state/store.ts";

const TOKEN = "CBF64DEOVQAXJFBSNGFEUT2AH4H7K5JBY3ZYJ5GVEINMNSDISWRG5N3F";
const ACCOUNT = "GCRYH6M5YLTGZTCAALJPIJGQZY4Z6XFFUVTINCELQG4OGLADUBTAE3OU";
const RECIPIENT = "GCV76XYE4MG555A76L3KHRCZ54FOOEYLKHJOGCXFSQDOULTKZOWSRJRB";
const keys = deriveKeys(123456789n, addressToField(TOKEN));
const sigma = 987654321n;
const finalBalance = 200_0000000n;

const events = [
  {
    type: "register",
    ledger: 10,
    txHash: "register",
    cursor: "10-register-0-0",
    account: ACCOUNT,
    auditorId: 0,
  },
  {
    type: "deposit",
    ledger: 11,
    txHash: "deposit",
    cursor: "11-deposit-0-0",
    from: ACCOUNT,
    to: ACCOUNT,
    amount: 1_000_0000000n,
  },
  {
    type: "merge",
    ledger: 12,
    txHash: "merge",
    cursor: "12-merge-0-0",
    account: ACCOUNT,
  },
  {
    type: "transfer",
    ledger: 13,
    txHash: "fund-escrow",
    cursor: "13-fund-escrow-0-0",
    from: ACCOUNT,
    to: RECIPIENT,
    rE: H,
    vTilde: 0n,
    sigma,
    bTilde: encryptBalance(finalBalance, keys.vk, sigma),
    vAudR: 0n,
    rAudR: 0n,
    vAudS: 0n,
    bAudS: 0n,
  },
];

const store = new MemoryStore();
await store.save({
  cacheVersion: 2,
  address: ACCOUNT,
  spendable: { v: 750_0000000n, r: 1n },
  receiving: { v: 0n, r: 0n },
  registered: true,
  syncedLedger: 12,
});

const client = {
  cfg: { contracts: { token: TOKEN } },
  server: {
    getHealth: async () => ({ oldestLedger: 1 }),
    getEvents: async () => ({ events: [], cursor: undefined, latestLedger: 20 }),
  },
  confidentialBalance: async () => ({
    spendableBalance: commit(finalBalance, deriveSpendR(keys.vk, sigma)),
    receivingBalance: commit(0n, 0n),
  }),
};
const accountHistory = { fetchAccountHistory: async () => events };
const engine = new StateEngine({
  client,
  store,
  keys,
  address: ACCOUNT,
  fromLedger: 1,
  accountHistory,
});

const state = await engine.sync();
const expectedR = deriveSpendR(keys.vk, sigma);
const disclosed = await engine.discloseHistoryAmounts(events);
const duplicated = await engine.discloseHistoryAmounts([
  ...events,
  { ...events[1], cursor: "11-deposit-wrong-source-coordinates" },
]);
// A prior Umbra request may have failed or returned partial history after the
// v3 migration marker was saved. A later sync must repair that stale cache.
await store.save({
  ...state,
  cacheVersion: 3,
  spendable: { v: 750_0000000n, r: 1n },
});
const repaired = await engine.sync();
const checks = [
  ["replaces the stale 750 balance", state.spendable.v === finalBalance],
  ["recovers the matching blinding factor", state.spendable.r === expectedR],
  ["migrates the cache to v3", state.cacheVersion === 3],
  ["preserves registration", state.registered],
  ["advances through the live RPC tail", state.syncedLedger === 20],
  ["discloses outgoing amount from complete verified openings", disclosed.get(events[3].cursor) === 800_0000000n],
  ["dedupes logical events before calculating outgoing amounts", duplicated.get(events[3].cursor) === 800_0000000n],
  ["repairs a stale v3 cache on every Umbra sync", repaired.spendable.v === finalBalance && repaired.spendable.r === expectedR],
];

let failed = 0;
console.log("Umbra state recovery:");
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failed++;
}
process.exit(failed === 0 ? 0 : 1);
