# Incidents and blockers

Last updated: August 4, 2026.

This document records the main engineering incidents encountered while making the Privacy PoC operational. It separates symptoms, root causes, resolutions, and preventive controls so future contributors do not repeat fixes by redeploying or clearing state.

## Operational principle

In this system, four layers can disagree temporarily:

1. on-chain escrow lifecycle;
2. Confidential Token commitments and events;
3. reconstructed private wallet state; and
4. browser UI and cached package artifacts.

A visible UI problem is not sufficient evidence that the on-chain payment failed. Diagnose the layer before taking another state-changing action.

## Incident 1 — Stale compiled SDK

### Symptom

```text
deployEscrow is not a function
```

or another newly exported SDK function appears missing at runtime.

### Root cause

The application imports the compiled `@ctd/sdk` package. The SDK source had changed, but the app was still loading an older `dist` build or an older Next.js generated bundle.

### Resolution

```bash
pnpm --filter @ctd/sdk build
rm -rf packages/app/.next
pnpm --filter @ctd/app dev
```

Clear `.next` only when rebuilding the SDK is insufficient.

### Preventive control

- Rebuild `@ctd/sdk` after changes to SDK exports, event decoders, state logic, or escrow adapters.
- Do not assume a source edit is visible to the app.
- Keep the SDK build step in contributor instructions and CI.

## Incident 2 — Stale factory contract or WASM

### Symptom

```text
trying to invoke non-existent contract function: deploy_escrow
```

### Root cause

The configured factory contract or packaged local WASM predated the `deploy_escrow` entry point.

### Resolution

1. Verify the local artifact exports `deploy_escrow`.
2. Verify the configured on-chain factory exports `deploy_escrow`.
3. Rebuild contract artifacts when local WASM is stale.
4. If the deployed factory alone is stale, deploy only a replacement factory using the existing protocol configuration.
5. Update only `NEXT_PUBLIC_FACTORY_CONTRACT_ID`.

### Preventive control

```bash
stellar contract info interface \
  --wasm packages/sdk/contracts/token_factory.wasm | grep deploy_escrow

stellar contract info interface \
  --contract-id "$NEXT_PUBLIC_FACTORY_CONTRACT_ID" \
  --network testnet | grep deploy_escrow
```

Do not redeploy the token, verifier, auditor, or USDC wrapper for a factory-only interface change.

## Incident 3 — Receiver empty after escrow reached `Released`

### Symptom

- Escrow status was `Released`.
- The nested transaction succeeded.
- Receiver private `Receiving` remained zero in the UI.

### Root cause

The Confidential Token contract emitted `spender_transfer` for a delegated escrow release. The wallet scanner and state engine initially recognized only ordinary `transfer` events.

The on-chain release was successful; the client failed to reconstruct it.

### Resolution

The SDK added:

- `spender_transfer` event decoding;
- Receiver-channel decryption;
- Receiver `Receiving` credit;
- Auditor decryption support;
- wallet activity rendering; and
- one-time legacy cache recovery without double-crediting.

### Preventive control

- Treat every state-changing token entry point as requiring an explicit event-decoder and replay rule.
- Add a regression test that reconstructs the exact Receiver commitment after release.
- Never submit a second release merely because the Receiver UI is empty.

## Incident 4 — Browser-local payer state became stale after funding

### Symptom

The browser that funded the escrow continued to show a plausible balance, but a reconstructed or migrated client could not prove that opening matched the live token commitment.

### Root cause

Funding changes Payer `Spendable` by moving value into a confidential allowance. Early recovery logic did not treat the spender operation as a first-class owner checkpoint.

### Resolution

The SDK added `set_spender` and `revoke_spender` event types and applies their owner-encrypted `b_tilde` and `sigma` checkpoints to Payer `Spendable`.

Umbra account history is replayed from the deployment ledger, and final openings are re-committed against the chain.

### Preventive control

- Block proof-carrying balance changes when local commitments mismatch.
- Include all owner-balance-changing events in the state machine.
- Never clear state as the first recovery action.

## Incident 5 — Duplicate balance after Umbra and RPC replay

### Symptom

A deposit, merge, or other event was applied twice after combining Umbra history with Stellar RPC.

### Root cause

Umbra and RPC used different event-coordinate conventions. The same logical event received different cursor strings, so cursor-only deduplication failed.

### Resolution

The SDK now:

- normalizes Umbra event coordinates;
- computes a logical identity from ledger, transaction hash, event type, participants, and event-specific cryptographic fields;
- deduplicates by both cursor and logical identity; and
- preserves source order among same-ledger events.

### Preventive control

- Do not use provider-specific IDs as the sole protocol identity.
- Add cross-source fixtures representing the same event with different cursors.
- Preserve stable same-ledger ordering because replay is order-sensitive.

## Incident 6 — Same-ledger event ordering risk

### Symptom

Potential reconstruction drift when multiple related events occur in one ledger, for example a deposit and merge.

### Root cause

Sorting by an arbitrary cursor string can reorder events with equal ledger numbers. A state machine can produce a different result if `merge` is applied before the credit it is intended to consume.

### Resolution

The deduplication path performs a stable sort by ledger and preserves input order within each ledger.

### Preventive control

- Avoid sorting by non-canonical string IDs.
- Add replay tests for multiple events in one ledger.
- Treat ordering as a protocol invariant, not an implementation detail.

## Incident 7 — RPC or CORS failure appeared as unregistered

### Symptom

The UI offered account registration after a failed read, even though the account might already be registered.

### Root cause

`confidentialBalance` converted every simulation or RPC error into `null`, conflating:

- explicit not-registered state;
- network failure;
- CORS failure;
- wrong contract configuration; and
- decoding failure.

### Resolution

Only explicit Confidential Token contract error `3501` maps to an unregistered account. Other errors propagate to the UI.

### Preventive control

- Distinguish negative state from unknown state.
- Parse contract error codes explicitly.
- Do not offer irreversible or duplicate setup actions after an ambiguous read failure.

## Incident 8 — Outgoing escrow amount misclassified as a sender disclosure

### Symptom

The Payer wallet could not recover the delegated release through the ordinary sender-channel path, or the UI risked implying that the Payer could create a normal sender selective-disclosure proof.

### Root cause

`spender_transfer` is executed by the escrow contract. The escrow generated the ephemeral transfer cryptography. The Payer address is the allowance owner, but it is not the cryptographic originator of the delegated transfer.

These identities must not be conflated:

- allowance owner;
- public `from` address;
- contract spender;
- transaction submitter;
- proof creator; and
- holder of sender-disclosure material.

### Resolution

The final owner-history model:

1. reconstructs the allowance from the Payer's verified `set_spender` checkpoint;
2. pairs it with the later `spender_transfer` for the same escrow;
3. relies on the full-release invariant to identify the release amount; and
4. labels the event as owner-visible reconstructed history, with “spender proof only” for third-party proof authority.

### Preventive control

- Document cryptographic roles separately from business roles.
- Never infer proof authority from the `from` address alone.
- Keep UI labels explicit about reconstructed visibility versus proof-backed disclosure.

## Incident 9 — Plausible but incomplete outgoing balance deltas

### Symptom

A partial event history could produce a numerically plausible outgoing amount even though the starting opening was missing or events were duplicated.

### Root cause

Balance-delta inference is only valid when the complete ordered replay is known to correspond to the current account state.

### Resolution

Outgoing inferred amounts are withheld unless:

```text
commit(reconstructed spendable) == on-chain spendable commitment
and
commit(reconstructed receiving) == on-chain receiving commitment
```

Incoming recipient amounts remain independently decryptable from their event ciphertexts.

### Preventive control

- Gate derived history on live commitment equality.
- Fail closed: omit an amount rather than display an unverified estimate.
- Keep the distinction between direct decryption and state-delta inference visible in code comments and docs.

## Incident 10 — Browser escrow directory loss

### Symptom

A fresh browser can reconstruct wallet balances but cannot automatically find prior factory-created escrow instances.

### Root cause

The factory returns the new contract address to the creating browser but emits no `escrow_deployed` event and maintains no global registry.

### Current workaround

- Preserve browser storage.
- Copy or import known escrow addresses manually when needed.
- Use the browser selector for instances created on that origin.

### Required fix

Add a factory event containing at least:

- new escrow address;
- creator/Approver;
- Confidential Token deployment;
- deployment salt or deterministic identifier; and
- ledger/transaction context.

Index the event and add an import/discovery flow.

## Incident 11 — Goldsky pipeline incomplete for spender events

### Symptom

The optional global indexer cannot provide complete recovery or history for escrow funding and release.

### Root cause

The checked-in Goldsky filter currently selects the base event family but not:

- `set_spender`;
- `revoke_spender`; or
- `spender_transfer`.

### Current mitigation

Umbra account-scoped history is the preferred wallet recovery source, with RPC for the live tail.

### Required fix

Extend the pipeline, database normalization, API response types, and parity fixtures for the spender event family.

## Incident response checklist

Before changing on-chain state:

1. Confirm the selected network and deployment.
2. Confirm the selected escrow contract.
3. Confirm the active Freighter address and intended role.
4. Read escrow state directly.
5. Read Confidential Token commitments directly.
6. Sync Umbra and RPC history.
7. Check for duplicate logical events.
8. Verify local commitments against chain.
9. Rebuild SDK and app artifacts if runtime exports are stale.
10. Only then decide whether a new transaction is required.

## Actions that usually make diagnosis worse

- rerunning the complete deployment script;
- creating a second escrow to replace an unknown-state escrow;
- releasing the same payment again;
- clearing browser storage before inspecting it;
- treating an RPC error as proof of non-registration;
- editing environment IDs as a trial-and-error diagnostic; or
- trusting a displayed amount that is not commitment-verified.

## Regression tests mapped to incidents

| Test | Incident covered |
|---|---|
| `release-recovery.mjs` | Receiver reconstruction and no double-credit |
| `umbra-history.mjs` | Umbra event decoding and owner checkpoints |
| `umbra-state-recovery.mjs` | Cross-origin deterministic rebuild |
| `dedup.mjs` | Cross-source logical deduplication |
| `registration-read.mjs` | Explicit registration error handling |
| `originator-sender-channel.mjs` | Correct sender-channel assumptions |
| `full-release-circuit.mjs` | Rejection of partial delegated release |
| `escrow-state.mjs` | Escrow lifecycle parsing |
| `contract-errors.mjs` | Stable contract error interpretation |
