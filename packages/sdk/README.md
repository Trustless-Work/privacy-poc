# @ctd/sdk — confidential-token client SDK

The TypeScript client for the [Trustless Work Privacy PoC](../../README.md). It builds witnesses, generates and verifies UltraHonk proofs, submits Soroban calls, decodes confidential events, reconstructs private balances, supports escrow delegation, and implements Auditor and selective-disclosure channels.

The SDK crypto is the off-chain mirror of the Noir circuits. Generators, domain tags, field arithmetic, public-input ordering, and derivations must remain identical across SDK, circuits, and contracts.

## Layers

- **`crypto/`** — Grumpkin, Pedersen commitments, Poseidon2 domains, field encoding, ECDH, and key derivation.
- **`witness/`** — builders for register, withdraw, transfer, `set_spender`, full-release delegated transfer, and disclosure circuits.
- **`proving/`** — UltraHonk proof generation through bb.js with the keccak transcript required by the on-chain verifier.
- **`chain/`** — RPC client, XDR envelopes, transaction submitters, factory and escrow calls, event parsing, Umbra history, global indexer access, and cross-source deduplication.
- **`state/`** — deterministic private-opening reconstruction, cache persistence, migrations, and on-chain commitment verification.
- **`auditor/`** — decryption of ordinary and delegated transfer Auditor channels.
- **`disclosure/`** — holder-side proving and verifier-side event resolution, VK pinning, and statement verification.

## Escrow support

The SDK supports the current factory-based one-milestone flow:

1. deploy a fresh escrow from the shared factory;
2. generate escrow-address-bound registration material;
3. initialize fixed Payer, Receiver, and Approver roles;
4. fund the escrow through `set_spender`;
5. recover the confidential allowance opening for the escrow spender;
6. build the modified full-release delegated-transfer witness;
7. submit `approve_and_release`; and
8. reconstruct the Receiver credit from `spender_transfer`.

The PoC-specific circuit requires:

```text
new_allowance_value == 0
```

General partial delegated spending is not supported by this escrow deployment.

## Confidential event model

The SDK currently decodes and replays:

| Event | Purpose |
|---|---|
| `register` | Mark confidential account registration |
| `deposit` | Credit private `Receiving` with a public amount |
| `merge` | Move `Receiving` into `Spendable` |
| `withdraw` | Recover the owner's post-withdraw `Spendable` opening |
| `transfer` | Update sender `Spendable` and credit receiver `Receiving` |
| `set_spender` | Recover owner post-funding `Spendable` and record allowance context |
| `revoke_spender` | Recover owner post-reclaim `Spendable` and clear allowance context |
| `spender_transfer` | Credit Receiver `Receiving` and represent an escrow release |
| compliance events | Surface policy and administration activity where applicable |

Unknown administrative events are ignored unless explicitly supported.

## State reconstruction and retention

The token contract stores commitments, not plaintext openings. The SDK reconstructs:

```text
spendable = { value, blinding }
receiving = { value, blinding }
```

from encrypted events and validates them against live chain commitments.

### Data sources

The recovery path can combine:

- **Umbra account history** — durable account-scoped encrypted history;
- **Goldsky indexer** — optional global durable history; and
- **Stellar RPC** — current reads and recent event tail.

The application configures Umbra through `NEXT_PUBLIC_UMBRA_URL` and the global indexer through `NEXT_PUBLIC_INDEXER_URL`.

The checked-in Goldsky pipeline does not yet ingest the spender event family. Umbra is therefore the preferred durable wallet-recovery source for the current escrow flow.

### Umbra rebuild

When `accountHistory` is configured, `StateEngine.sync()`:

1. fetches history from `fromLedger`;
2. resets to a fresh account state;
3. normalizes and deduplicates history;
4. replays every supported event in stable order;
5. records recovered cursors and logical identities;
6. fetches the RPC/indexer live tail;
7. skips overlap by cursor or logical identity;
8. persists the result; and
9. verifies reconstructed commitments against the Confidential Token contract.

Umbra is replayed on every sync rather than only once. This repairs stale or partially migrated local caches when complete history remains available.

### Event identity and deduplication

Cross-source cursor equality is insufficient. Umbra and RPC may encode event coordinates differently.

`eventIdentity()` derives a protocol-level identity from:

- ledger;
- transaction hash;
- event type;
- relevant accounts and spender;
- public amount where applicable; and
- event-specific encrypted commitment fields.

`dedupeById()` rejects duplicates when either canonical cursor or logical identity matches.

The final array is stably ordered by ledger. Equal-ledger events retain source order because replay order is load-bearing.

### Commitment verification

`StateEngine.verifyAgainstChain()` re-commits the local openings and compares them with the token contract.

A mismatch means local state is stale, partial, duplicated, reordered, derived under the wrong deployment, or otherwise incompatible. The application must block proof-carrying operations in that state.

## Amount recovery

### Incoming ordinary transfer

The Receiver decrypts the event through ECDH with its viewing key and `r_e`, then derives the transfer amount and blinding.

### Incoming escrow release

The Receiver decrypts `spender_transfer` using the recipient channel and `sigma_a`. The result is added to private `Receiving`.

### Outgoing ordinary transfer

For a wallet-originated transfer, the SDK can rederive deterministic ephemeral material and recover the sender channel when the event was generated with the same keys.

### Outgoing escrow release

The Payer is the allowance owner but not the cryptographic originator of `spender_transfer`.

The owner-visible amount is reconstructed as follows:

1. replay reaches a verified pre-funding `Spendable` opening;
2. `set_spender` exposes the owner-encrypted post-funding opening;
3. their difference is the allowance associated with the spender contract;
4. a later `spender_transfer` for that spender consumes the allowance; and
5. the full-release circuit guarantees the released value equals the complete allowance.

This amount is local owner history. It is not a Payer sender selective-disclosure proof.

### Conservative disclosure rule

Incoming ciphertext amounts can be shown when direct decryption succeeds.

Outgoing inferred amounts are exposed only when the complete replay opens both current on-chain balance commitments. Partial history returns unavailable rather than a plausible estimate.

See [Recovery model](../../docs/recovery-model.md).

## Registration read semantics

`ChainClient.confidentialBalance(address)` returns `null` only when the contract returns the explicit not-registered error.

RPC, CORS, configuration, simulation, and decoding failures are propagated. This prevents the UI from offering registration after an ambiguous read failure.

## Local persistence

Stores implement the `StateStore` interface. The browser store persists:

- reconstructed openings;
- sync cursor;
- last ledger;
- registration state; and
- cache version.

A cache version supports targeted migrations when new event semantics are added. With Umbra configured, the preferred migration is a complete deterministic rebuild.

Local persistence is operationally important but not independently authoritative.

## Auditor support

The Auditor package decrypts:

- ordinary transfer sender and receiver channels;
- delegated `spender_transfer` channels; and
- supported post-operation balance checkpoints.

The Auditor is intentionally privileged. Key custody and rotation are product and operational responsibilities outside the current SDK guarantees.

## Selective disclosure

The disclosure package supports proof-backed statements for supported holder-generated transfers.

Do not infer disclosure authority solely from the public `from` address. An escrow-executed delegated transfer was generated by the spender contract context, so the Payer wallet does not hold ordinary sender-proof material for that event.

## Build and test

```bash
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/sdk typecheck
pnpm --filter @ctd/sdk test:fast
pnpm --filter @ctd/sdk test
```

The tests are `.mjs` scripts run with `tsx`. Run one directly with:

```bash
pnpm --filter @ctd/sdk exec tsx test/<name>.mjs
```

## Important tests

| Test | Coverage |
|---|---|
| `parity.mjs` | SDK witness values solve the actual Noir circuits |
| `prove.mjs` | Real UltraHonk proof generation and verification |
| `payload.mjs` | XDR payload and point serialization |
| `escrow-witness.mjs` | Funding, delegation-key recovery, and release witness invariants |
| `full-release-circuit.mjs` | Partial delegated release is rejected |
| `escrow-state.mjs` | Escrow state parsing |
| `release-recovery.mjs` | Receiver credit and no double replay |
| `umbra-history.mjs` | Umbra event parsing and owner checkpoints |
| `umbra-state-recovery.mjs` | Cross-origin deterministic state rebuild |
| `dedup.mjs` | Canonical and logical duplicate protection |
| `registration-read.mjs` | Explicit negative state versus infrastructure failure |
| `originator-sender-channel.mjs` | Sender-channel and delegated-originator distinctions |
| `auditor.mjs` | Auditor channel decryption |
| `disclosure.mjs` | Selective-disclosure proof and verification protocol |
| `indexer-parity.mjs` | Global indexer parity where configured |
| `shape-filter.mjs` | Goldsky event-family filter assumptions |

## Change checklist

When adding a new state-changing token event:

1. define its TypeScript event type;
2. add it to `KNOWN`;
3. decode RPC payload shape;
4. decode Umbra payload shape;
5. define logical event identity;
6. implement state replay semantics;
7. decide direct amount-decryption behavior;
8. decide owner-history behavior;
9. add Auditor behavior where applicable;
10. update the global indexer pipeline;
11. add deduplication and ordering fixtures; and
12. verify final openings against live commitments.

## Current limitations

- recovery depends on complete compatible history and confidential keys;
- the global indexer is incomplete for spender events;
- escrow discovery is outside the SDK's current indexed model;
- browser secret storage is demo-grade;
- the PoC supports full release only; and
- all circuits and verifier paths remain developer preview and unaudited for production use.
