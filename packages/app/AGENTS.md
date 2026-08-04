# AGENTS.md — Green Road application guidance

This file provides repository-specific instructions for AI agents and reviewers working under `packages/app/`.

## Product context

Green Road is the scenario-first front end for the Trustless Work Privacy PoC. It demonstrates a one-milestone marketplace escrow using Stellar Confidential Tokens and testnet USDC.

The business story is:

1. Alberto prepares private USDC.
2. Ziggy creates a fresh escrow through the shared factory.
3. Alberto funds the selected escrow with one confidential allowance.
4. Ziggy approves delivery and releases the complete allowance.
5. Buju B. reconstructs the private receipt, merges it, and optionally withdraws public USDC.

Do not reduce this application to a visual mock. The role pages execute real Freighter, proof-generation, SDK, factory, escrow, and Confidential Token operations.

## Current topology

The current application is factory-based, not singleton-based.

- The protocol is deployed once.
- The shared factory deploys fresh escrow contracts.
- The Approver initializes the fixed roles after deployment.
- The browser stores known escrow IDs per Confidential Token deployment.
- The top navigation lets users switch the active escrow.
- The same participant addresses may be reused across independent instances.

Do not reintroduce documentation or code assumptions that every page points to one pre-deployed escrow.

## Primary routes

| Route | Purpose |
|---|---|
| `/` | Green Road scenario landing page |
| `/escrow` | Guided marketplace escrow journey |
| `/escrow/approver` | Create, initialize, and release escrow instances |
| `/escrow/payer` | Fund the selected escrow with a private allowance |
| `/escrow/receiver` | Inspect selected escrow and guide Receiver recovery |
| `/wallet` | Register, deposit, merge, transfer, withdraw, sync, and inspect history |
| `/auditor` | Decrypt supported confidential activity with the configured Auditor key |
| `/verify` | Verify supported selective-disclosure proofs |
| `/advanced` | Configure alternate deployments |
| `/admin` | Confidential Token and policy administration tools |

## Authoritative files

Before changing behavior, inspect:

- `lib/deployment.ts` — deployment IDs, history sources, and asset configuration;
- `lib/active-deployment.tsx` — active deployment and browser-local escrow directory;
- `lib/escrow.ts` — factory, initialization, funding, and release orchestration;
- `lib/wallet.ts` — confidential wallet lifecycle, event loading, and disclosure integration;
- `lib/rpc.ts` — shared ChainClient, Umbra, and indexer construction;
- `app/escrow/*` — role-specific journeys and selected escrow state;
- `app/wallet/events-panel.tsx` — owner-visible history labels and disclosure controls;
- `../sdk/src/state/engine.ts` — authoritative replay and amount-recovery semantics;
- `../sdk/src/chain/events.ts` — event shapes;
- `../sdk/src/chain/event-source.ts` — cross-source identity and deduplication; and
- `../../docs/recovery-model.md` — current recovery contract.

## Critical invariants

### Escrow lifecycle

```text
Initialized -> Funded -> Released
```

- One escrow equals one milestone.
- Release must exhaust the complete allowance.
- The fixed Receiver cannot be changed at release time.
- A successful nested transfer and lifecycle update are atomic.
- A released escrow cannot be reused.

### Active escrow safety

- All role pages must operate on the same selected escrow ID.
- Switching the selected escrow must invalidate or disconnect controllers bound to the prior address.
- Never silently fall back to another escrow after a failed read.
- Display the active escrow address in state-changing contexts.

### Private-state safety

- Private balances are reconstructed openings, not direct contract plaintext reads.
- Never enable proof-carrying actions when local commitments mismatch the chain.
- Never convert an unknown RPC state into a zero balance or unregistered state.
- Never treat browser storage as authoritative without commitment verification.

### Event safety

The SDK must understand every event that changes owner or Receiver state:

- `register`;
- `deposit`;
- `merge`;
- `withdraw`;
- `transfer`;
- `set_spender`;
- `revoke_spender`; and
- `spender_transfer`.

Cross-source history must be deduplicated by canonical cursor and logical payload identity while preserving same-ledger order.

## Role distinctions

Do not conflate:

- Payer business role;
- public `from` address;
- allowance owner;
- escrow spender contract;
- Approver transaction submitter;
- proof creator;
- cryptographic transfer originator; and
- selective-disclosure authority.

For `spender_transfer`:

- the Payer owns the allowance;
- the escrow contract executes the delegated transfer;
- the escrow-generated ephemeral material is not rederivable by the Payer wallet;
- the Payer may see the amount reconstructed from the verified allowance checkpoint; and
- the Payer must not be shown as having a normal sender disclosure proof.

Use labels such as **reconstructed from allowance** and **spender proof only** where applicable.

## Recovery behavior

When Umbra is configured:

1. Account history is fetched from the deployment ledger.
2. History is normalized and logically deduplicated.
3. State is rebuilt from zero.
4. The RPC live tail is fetched.
5. Overlap is skipped.
6. Final openings are checked against live on-chain commitments.

Umbra is not trusted as balance authority.

Incoming amounts may be directly decrypted from recipient ciphertexts. Outgoing balance-delta amounts may be shown only when complete replay matches both current commitments.

## Browser storage

Browser storage currently contains operationally important state:

- confidential key cache;
- reconstructed openings;
- cursor and cache version;
- known escrow IDs; and
- active escrow selection.

Do not add “clear storage” as a routine troubleshooting instruction. First inspect and export relevant state. A full Umbra rebuild may recover balances, but it cannot automatically recover the escrow directory until the factory emits a discovery event.

## SDK build boundary

The app imports the compiled SDK. After SDK source changes:

```bash
pnpm --filter @ctd/sdk build
```

If Next.js still loads stale exports:

```bash
rm -rf packages/app/.next
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

Do not report a runtime export error as a contract or protocol failure before rebuilding.

## bb.js and browser proving

Browser proving requires cross-origin isolation and the vendored bb.js browser bundle.

Do not webpack-bundle `@aztec/bb.js` directly. Preserve:

- `scripts/vendor-bb.mjs`;
- the webpack alias that disables direct bundling;
- `lib/bb-loader.ts` native ESM runtime loading; and
- COOP/COEP headers required for `SharedArrayBuffer`.

Changes here must be validated with a production app build and an actual proof flow.

## UI requirements

The UI should always make these contexts visible before a transaction:

- network;
- Confidential Token deployment;
- selected escrow;
- active Freighter public key;
- intended role;
- current escrow status; and
- whether reconstructed state matches the chain.

Transaction progress should distinguish:

- connecting;
- reading state;
- generating a proof;
- requesting Freighter signature;
- submitting;
- waiting for confirmation; and
- syncing encrypted history.

Do not use a generic spinner for the entire proving and transaction lifecycle when the phase is available.

## Documentation rules

Current-state documentation must not say:

- the app uses one singleton escrow;
- creating another escrow requires `scripts/deploy.ts`;
- `set_spender` lacks a recoverable owner checkpoint;
- only ordinary `transfer` events affect wallet history; or
- the Payer has ordinary sender-proof authority for an escrow release.

Historical stages belong in `docs/implementation-history.md`.

## Review questions for agents

Before approving a change, answer:

1. Which values and metadata remain public after this change?
2. Which party generated each cryptographic value used by the flow?
3. Does any path infer a confidential amount from incomplete history?
4. Does every inferred outgoing amount remain gated by live commitment equality?
5. Can Umbra and RPC represent the same event with different IDs?
6. Could same-ledger events be reordered?
7. Does switching escrows leave a stale controller connected?
8. Does an RPC error become a false unregistered or zero state?
9. Does the UI distinguish owner visibility from third-party proof authority?
10. Does the change require rebuilding SDK, contract WASM, circuits, or bb.js assets?

## Validation

Minimum package checks:

```bash
pnpm --filter @ctd/sdk typecheck
pnpm --filter @ctd/sdk test:fast
pnpm --filter @ctd/app build
```

Run focused tests when changing recovery or event semantics:

```bash
pnpm --filter @ctd/sdk exec tsx test/release-recovery.mjs
pnpm --filter @ctd/sdk exec tsx test/umbra-history.mjs
pnpm --filter @ctd/sdk exec tsx test/umbra-state-recovery.mjs
pnpm --filter @ctd/sdk exec tsx test/dedup.mjs
pnpm --filter @ctd/sdk exec tsx test/registration-read.mjs
pnpm --filter @ctd/sdk exec tsx test/originator-sender-channel.mjs
```

For contract, circuit, or deployment changes, also rebuild the relevant artifacts and validate the actual Stellar testnet flow.

## Known product gaps

- no cross-device escrow discovery;
- no multi-milestone or partial release;
- no dispute or cancellation state;
- no platform fee;
- Payer can revoke before release;
- incomplete global indexer coverage for spender events;
- browser-local secret caching;
- developer-preview cryptography; and
- no production security audit.

Do not hide these limitations in UX or documentation.
