# Implementation history

Last updated: August 4, 2026.

This document explains how the Privacy PoC evolved from a research scaffold into the current Green Road demo. It preserves the architectural pivots without treating superseded implementations as current behavior.

## Timeline summary

| Phase | Outcome | Representative commits |
|---|---|---|
| Research framing | Defined privacy boundary, USDC strategy, threat model, and go/no-go criteria | `a853c8f`, `8e41132` |
| Confidential escrow core | Added contracts, circuits, SDK witnesses, deployment, and tests | `c3e0fdb` |
| Singleton end-to-end flow | Proved one complete confidential escrow lifecycle | `c162043`, `6c1db40` |
| Factory productization | Moved from one pre-deployed escrow to wallet-created instances | `18f0ede` |
| Multi-instance support | Added browser history and active escrow selection | `9b4d2fe` |
| Recovery of releases | Added `spender_transfer` decoding and Receiver credit | `518ccea` |
| Durable account recovery | Added Umbra history replay and commitment verification | `a1eedf0` |
| Recovery hardening | Fixed registration errors, duplicate replay, and outgoing history disclosure | `64d55cc` through `486c564` |
| Scenario and UX | Converted the protocol flow into the Green Road marketplace demo | `2f979dc` through `c4f0cee` |

## Phase 1 — Research question and security boundary

### `a853c8f` — Initialize confidential USDC escrow PoC

The repository started with a narrow research question:

> Can a Trustless Work escrow spend a confidential delegated allowance while preserving amount privacy and binding the transfer to an authorized milestone flow?

The initial scope distinguished:

- public participant addresses, contract calls, lifecycle state, and timing;
- confidential balances, allowance, and payment amount; and
- controlled visibility for an Auditor and selective-disclosure verifier.

The repository was intentionally separated from Trustless Work production v2. This avoided presenting experimental circuits, verifier contracts, or event-recovery behavior as production-ready infrastructure.

### `8e41132` — Add confidential USDC escrow PoC scaffold

The scaffold established:

- the monorepo package boundaries;
- architecture and threat-model documents;
- the USDC-first strategy;
- ADR 0001 for reusing the reference monorepo;
- a phased implementation plan; and
- the rule that real value and mainnet use were out of scope.

A key strategic decision was to reuse the Stellar Confidential Token reference implementation at pinned dependencies and focus new engineering on escrow delegation and recovery.

## Phase 2 — Confidential escrow core

### `c3e0fdb` — Implement confidential USDC escrow core

This was the primary protocol implementation commit. It imported and adapted:

- Confidential Token contracts;
- UltraHonk verifier and verification-key registry;
- Auditor registry;
- TypeScript cryptography and witness generation;
- browser proving artifacts;
- event parsing and state reconstruction;
- disclosure circuits and verifier flows; and
- testnet deployment scripts.

It added the Trustless Work-specific escrow contract and a dedicated full-release circuit.

### Full-release simplification

The original design considered a separate confidential milestone commitment. The implementation chose a smaller proof surface:

- the delegated allowance is the milestone amount;
- the release circuit proves a valid delegated transfer; and
- one added constraint requires the remaining allowance to equal zero.

```text
new_allowance_value == 0
```

This makes the release amount equal the complete prior allowance without publishing either value.

The tradeoff is explicit: the PoC proves one milestone and one complete release, not general private milestone accounting.

## Phase 3 — Singleton end-to-end proof

### `c162043` — Add guided private escrow walkthrough

The first role-oriented UI separated:

- wallet preparation;
- initialization;
- funding;
- approval and release;
- Receiver merge; and
- audit or disclosure.

This made the underlying protocol sequence reproducible by a non-author developer.

### `6c1db40` — Implement singleton confidential escrow v1

The first working topology deployed one escrow together with the protocol. All role pages referenced the same contract.

This implementation proved:

- fixed-role initialization;
- private allowance creation;
- Approver-generated full-release proof;
- atomic nested delegated transfer;
- terminal `Released` state; and
- Receiver reconstruction and withdrawal flow.

The singleton was deliberately temporary. It removed factory and discovery questions while validating the cryptographic and contract invariant.

## Phase 4 — Factory-based productization

### `18f0ede` — Create escrows from Freighter

The architecture changed from one pre-deployed escrow to a shared factory:

1. Deploy protocol once.
2. Approver calls `deploy_escrow` through Freighter.
3. Factory returns the fresh contract address.
4. Browser generates address-bound registration material.
5. Approver initializes the new escrow.

This separated protocol deployment from normal product usage. Creating another escrow no longer required CLI access or replacing shared contract IDs.

### `9b4d2fe` — Support multiple selectable escrow instances

The application added:

- known escrow arrays per Confidential Token deployment;
- active escrow selection;
- migration from the earlier single-address browser key;
- a navigation selector; and
- controller disconnection when switching instances.

The same Payer, Receiver, and Approver addresses can now participate in multiple independent contracts.

The remaining discovery limitation is architectural: the factory returns the address but emits no `escrow_deployed` event, so another browser cannot enumerate prior instances automatically.

## Phase 5 — Green Road product narrative

### `2f979dc` — Turn privacy PoC into Irie Market demo

The technical flow became a marketplace story:

- Alberto orders a product;
- Ziggy creates and operates the escrow;
- Alberto funds privately; and
- Buju B. receives the private release.

The scenario made the difference between public order flow and confidential value flow easier to understand.

### `ce1399c` — Refine Irie Market order journey

The journey was reorganized around user intent rather than protocol internals while preserving the actual contract and wallet operations.

### `d83f0d2`, `432253f`, `931d761`, `200a031`, `2169563`

These commits standardized the neo-brutalist visual system, wallet preparation, role guidance, color palette, and interaction consistency.

### `c4f0cee` — Rename marketplace to Green Road

The final demo identity became Green Road.

## Phase 6 — Receiver release recovery

### `518ccea` — Recover confidential escrow releases from events

A released escrow could be correct on-chain while the Receiver wallet remained empty.

Root cause:

- normal wallet transfers emit `transfer`;
- delegated escrow releases emit `spender_transfer`; and
- the state engine initially recognized only `transfer`.

The SDK was extended to:

- parse `spender_transfer`;
- decrypt the Receiver channel;
- credit private `Receiving`;
- display release activity;
- support Auditor decryption; and
- replay previously skipped releases without double-crediting.

This incident established that client recovery logic is part of the confidential asset protocol, not merely UI presentation.

## Phase 7 — Durable Umbra recovery

### `a1eedf0` — Recover private balances from Umbra history

RPC event retention made cross-browser and stale-cache recovery unreliable. The app added an account-scoped Umbra client.

The state engine now:

- fetches durable account history;
- rebuilds from a fresh state;
- reads the recent RPC tail;
- checks reconstructed openings against the live token commitments; and
- persists the validated result.

Umbra is untrusted for correctness. It can supply history, but it cannot authorize a forged balance because the reconstructed openings must match on-chain commitments.

## Phase 8 — Recovery and disclosure hardening

### `083f160` — Fix wallet contrast and guard stale private state

The UI began blocking proof-carrying operations when reconstructed private state did not match the chain.

This prevents stale local openings from being used merely because they appear plausible.

### `64d55cc` — Restore registration checks and disclose sent history

The account read previously treated all failures as “not registered.” The fix maps only the explicit contract error to an unregistered account and propagates RPC, CORS, configuration, and decoding failures.

The wallet event feed also began combining Umbra account history with global/RPC history.

### `4c2fea1` — Disclose outgoing amounts from wallet history

The implementation explored deriving outgoing amounts from consecutive owner-visible balance openings.

This direction exposed an important safety condition: a balance delta is only meaningful when history is complete and ordered.

### `768de6c` — Decrypt outgoing amounts from sender channel

Ordinary owner-created transfers can use deterministic sender-channel recovery when the same wallet keys generated the event.

The delegated escrow path remained different because the escrow, not the Payer wallet, generated the transfer's ephemeral cryptography.

### `b5ea96e` — Fix duplicate history replay and disclose outgoing amounts

Umbra and RPC assigned different cursors to the same logical event. The same protocol event could therefore be replayed twice.

The fix added:

- normalized Umbra event coordinates;
- logical event identity derived from payload and participants;
- deduplication by cursor and logical identity;
- stable same-ledger ordering; and
- commitment-gated outgoing amount disclosure.

### `486c564` — Fix escrow owner history disclosure

The final model distinguishes three concepts:

1. **Owner-visible amount** — the Payer can reconstruct the allowance from `set_spender` and pair it with the full-release event.
2. **Cryptographic sender proof** — the Payer cannot claim this for `spender_transfer`, because the escrow generated the transfer.
3. **Spender proof authority** — only the spender context possesses the corresponding delegated-transfer cryptographic material.

The SDK added `set_spender` and `revoke_spender` as first-class events and uses their owner checkpoints in deterministic replay.

## Current state

The repository now demonstrates:

- factory-created one-milestone confidential escrows;
- full private allowance release to a fixed Receiver;
- multiple selectable instances;
- durable account recovery through Umbra plus RPC;
- commitment-verified reconstructed balances;
- logically deduplicated cross-source history;
- Receiver and Auditor views of escrow releases; and
- conservative owner-visible outgoing history.

## Superseded assumptions

The following statements describe historical stages and must not be presented as the current architecture:

- the protocol supports only one pre-deployed singleton escrow;
- another escrow requires rerunning the deployment script;
- `set_spender` has no recoverable owner checkpoint;
- the wallet understands only `transfer` for payment recovery;
- RPC cursor equality alone is sufficient to deduplicate multiple history sources; or
- the Payer can build a normal sender disclosure proof for an escrow-executed `spender_transfer`.

## Next architectural milestones

1. Add the spender event family to the global durable indexer.
2. Emit and index `escrow_deployed` from the factory.
3. Add escrow import and cross-device discovery.
4. Define multi-milestone, cancellation, dispute, and fee semantics.
5. Replace browser-local key caching with production custody and recovery UX.
6. Complete independent audits and information-leakage analysis.
