# Current implementation and testnet runbook

Last updated: August 4, 2026.

This document is the operational handoff for the working Trustless Work Privacy PoC. It describes the current factory-based deployment, the successful end-to-end flow, private-state recovery, diagnostics, and safety rules.

## System at a glance

The protocol is deployed once per environment. It consists of:

- a USDC Stellar Asset Contract;
- a Confidential Token wrapper;
- an UltraHonk verifier;
- an auditor registry;
- a shared escrow factory; and
- independent one-milestone escrow instances.

The factory creates a fresh contract for every escrow. The same Payer, Approver, and Receiver addresses may be reused across any number of instances.

The frontend stores known escrow IDs per Confidential Token deployment and exposes an escrow selector. Creating another instance appends to this browser-local history. Switching instances disconnects any controller associated with the previous escrow.

## Roles

| Role | Responsibility |
|---|---|
| Payer | Registers, deposits, merges, and funds the selected escrow with a private allowance |
| Approver | Creates and initializes escrow instances, then authorizes full release |
| Receiver | Reconstructs the incoming release, merges it, and optionally withdraws public USDC |
| Auditor | Decrypts supported confidential activity with the configured auditor key |
| Factory | Deploys fresh escrow contracts from the installed WASM |
| Escrow contract | Acts as the authorized spender for exactly one delegated allowance |

## Successful flow

1. Prepare three Freighter testnet accounts for Payer, Approver, and Receiver.
2. Register the Payer and Receiver against the current Confidential Token deployment.
3. Deposit testnet USDC for the Payer. The deposit appears in private `Receiving`.
4. Merge the Payer's `Receiving` balance into private `Spendable`.
5. From the Approver page, create a fresh escrow and initialize the fixed roles.
6. From the Payer page, fund the selected escrow. Funding creates a confidential allowance controlled by that escrow contract.
7. From the Approver page, generate and submit the full-release proof.
8. From the Receiver wallet, sync history. The release appears in private `Receiving`.
9. Merge Receiver `Receiving` into private `Spendable`.
10. Withdraw only when public USDC in Freighter is desired.

## Release semantics

Release is atomic. The escrow cannot enter `Released` if the nested Confidential Token transfer fails.

The PoC-specific delegated-transfer circuit requires the post-release allowance to equal zero. Therefore:

```text
receiver amount == complete pre-release allowance
```

The token emits `spender_transfer` rather than an ordinary `transfer`. Its topics identify spender, Payer, and Receiver. Its encrypted fields allow the Receiver and configured Auditor to reconstruct the amount without publishing it.

The Payer did not generate this delegated transfer's ephemeral cryptography. The wallet therefore must not represent the release as a Payer-created sender proof. The Payer-visible release amount is reconstructed from the earlier owner checkpoint emitted by `set_spender`, paired with the escrow's full-release event.

## Private balance interpretation

| State | Meaning | Next action |
|---|---|---|
| `Receiving > 0` | Private value has arrived | Merge |
| `Receiving = 0`, `Spendable > 0` | Private value is available to spend or withdraw | Use privately or withdraw |
| Both `0`, commitments match | No current private balance exists for this account and deployment | Verify role, deployment, and expected history |
| Commitments mismatch | Local reconstruction is stale, partial, duplicated, or incompatible | Sync and inspect diagnostics; do not submit a proof |
| Account read failed | Registration state is unknown | Fix RPC, CORS, deployment, or decoding error before acting |

Freighter displays public balances only. Merge remains private. Withdraw returns value to public USDC.

## Current recovery path

When Umbra account history is configured, every sync performs a deterministic rebuild:

1. Fetch account-scoped history from Umbra from the deployment ledger.
2. Normalize Umbra event coordinates into the SDK's canonical event identity.
3. Deduplicate by canonical cursor and protocol payload identity.
4. Replay account history from a fresh zero state.
5. Fetch the current RPC tail.
6. Skip RPC events already represented in the recovered history.
7. Apply the remaining live events in stable protocol order.
8. Persist the reconstructed openings and cursor.
9. Re-commit the openings and compare them with the live token commitments.

Umbra is an availability service, not a balance authority. A malicious or broken history response cannot produce a spendable forged opening unless it also matches the on-chain commitment.

Without Umbra, the SDK uses the optional Goldsky indexer for old global history and Stellar RPC for the recent tail. The checked-in Goldsky pipeline is not yet complete for the spender event family, so Umbra is the preferred recovery path for the current demo.

Without Umbra or a complete indexer, RPC-only recovery is limited by RPC event retention.

## Owner-visible outgoing history

The wallet can show outgoing ordinary transfers and escrow releases, but the derivations differ.

### Ordinary transfer

The owner wallet generated the transfer and can recover its amount through the sender channel when the event was built with the same deterministic keys.

### Escrow funding and release

1. `set_spender` moves value from Payer `Spendable` into a confidential allowance and emits an owner-encrypted post-operation balance checkpoint.
2. The allowance equals the difference between the prior verified opening and the post-funding opening.
3. `spender_transfer` identifies the escrow contract that consumed the allowance.
4. Because the PoC enforces complete allowance exhaustion, the release amount equals the previously reconstructed allowance.
5. The UI labels this as reconstructed owner history and marks third-party sender proof as available only to the spender context.

The SDK exposes inferred outgoing amounts only when complete replay opens both current on-chain balance commitments. Incoming recipient amounts remain independently decryptable.

## Daily startup

```bash
git switch main
git pull origin main
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

If Next.js reports that an SDK export is missing or not a function:

```bash
rm -rf packages/app/.next
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

Do not clear browser storage during private-state or escrow-discovery diagnosis. It contains cached openings, cursor/version data, derived key cache, known escrow IDs, and the active escrow selection.

## Creating additional escrows

Use **Create new escrow instance** on the Approver page:

1. Confirm Freighter is on testnet and the Approver account is active.
2. Enter valid, distinct Payer and Receiver addresses.
3. Sign the factory deployment request.
4. Sign the deployment-bound key message when prompted.
5. Sign the escrow initialization request.
6. Confirm the new `C...` address appears in the escrow selector.
7. Switch roles and continue the selected escrow flow.

Do not run `scripts/deploy.ts` to create another escrow.

## Factory compatibility check

The configured factory must export `deploy_escrow`:

```bash
stellar contract info interface \
  --contract-id "$NEXT_PUBLIC_FACTORY_CONTRACT_ID" \
  --network testnet | grep deploy_escrow
```

The local artifact must also export it:

```bash
stellar contract info interface \
  --wasm packages/sdk/contracts/token_factory.wasm | grep deploy_escrow
```

If the local artifact is stale, rebuild contracts. If only the deployed factory is stale, deploy a replacement factory using the current factory WASM and the existing deployment's constructor inputs, then update only `NEXT_PUBLIC_FACTORY_CONTRACT_ID`.

Do not replace the token, verifier, auditor, USDC, or deployment ledger during a factory-only upgrade. Existing escrows remain independent of the factory that created them.

## Deployment safety rules

- Do not rerun the full protocol deployment to create an escrow.
- Do not redeploy while diagnosing Receiver visibility or history reconstruction.
- Do not release the same business payment again because a UI balance is empty.
- Do not clear browser storage before exporting or intentionally abandoning its operational state.
- Confirm the active deployment, escrow ID, role, and Freighter address before every state-changing transaction.
- Never submit proof-carrying operations while local commitments mismatch the chain.
- Rebuild `@ctd/sdk` after SDK source changes.
- Rebuild contract WASM after Rust contract changes; source edits do not change deployed or packaged artifacts.
- Treat a failed account read as an infrastructure/configuration error unless the contract returned the explicit not-registered error.

## Relevant events

| Source | Events | Current use |
|---|---|---|
| Confidential Token | `register`, `deposit`, `merge`, `withdraw`, `transfer` | Base wallet state and activity |
| Confidential Token | `set_spender`, `revoke_spender` | Owner checkpoints and allowance history |
| Confidential Token | `spender_transfer` | Receiver credit, Auditor view, and escrow release history |
| Escrow | `init`, `funded`, `released` | Lifecycle and diagnostics |
| Factory | No deployment event | New address is returned directly to the creating browser |

The SDK/RPC/Umbra paths understand the spender event family. The checked-in Goldsky pipeline does not yet select those events.

## Verified incidents and resolutions

### `deployEscrow is not a function`

**Cause:** the application loaded an older compiled SDK bundle.

**Resolution:** rebuild `@ctd/sdk`, clear only `.next` if necessary, and restart.

### `trying to invoke non-existent contract function: deploy_escrow`

**Cause:** the configured on-chain factory or local WASM predated the factory entry point.

**Resolution:** rebuild the current factory artifact, deploy only the upgraded factory, and change only the factory contract ID.

### Receiver remained empty after `Released`

**Cause:** the wallet scanner recognized ordinary `transfer` but ignored `spender_transfer`.

**Resolution:** decode and replay the delegated-transfer event, credit Receiver `Receiving`, and migrate old caches without double-crediting.

### Balance doubled after Umbra plus RPC sync

**Cause:** Umbra and RPC assigned different cursors to the same logical event because their coordinate conventions differed.

**Resolution:** normalize Umbra coordinates and deduplicate by both cursor and protocol payload identity.

### RPC/CORS failure appeared as unregistered

**Cause:** all account-read errors were converted to `null`.

**Resolution:** only explicit contract error `3501` maps to not registered; infrastructure and decoding failures propagate.

### Payer release amount was unavailable or misclassified

**Cause:** the delegated transfer was treated as if the Payer wallet had generated the spender's ephemeral scalar.

**Resolution:** reconstruct the allowance from `set_spender`, pair it with `spender_transfer`, and label the event as owner-visible history rather than a Payer sender proof.

See [Incidents and blockers](incidents-and-blockers.md) for the engineering history and preventive controls.

## Validation commands

```bash
pnpm --filter @ctd/sdk typecheck
pnpm --filter @ctd/sdk test:fast
pnpm --filter @ctd/app build
```

Relevant focused checks include:

```bash
pnpm --filter @ctd/sdk exec tsx test/release-recovery.mjs
pnpm --filter @ctd/sdk exec tsx test/umbra-history.mjs
pnpm --filter @ctd/sdk exec tsx test/umbra-state-recovery.mjs
pnpm --filter @ctd/sdk exec tsx test/dedup.mjs
pnpm --filter @ctd/sdk exec tsx test/registration-read.mjs
pnpm --filter @ctd/sdk exec tsx test/originator-sender-channel.mjs
```

## Known limitations

- One escrow instance represents one milestone.
- Release always transfers the complete allowance.
- The Payer can revoke the delegation before release.
- Escrow history and selection remain browser-local.
- The factory emits no discovery event.
- The Goldsky pipeline omits the spender event family.
- Recovery requires complete compatible history plus the wallet's confidential key.
- Deposits, withdrawals, addresses, timing, and transaction graph remain public.
- Contracts, circuits, verifier, browser key storage, and Auditor operations require production-grade security work.

## Recommended next technical work

1. Add `set_spender`, `revoke_spender`, and `spender_transfer` to the durable global indexer pipeline.
2. Add an `escrow_deployed` factory event and index escrow lifecycle events.
3. Build escrow import/discovery so browser storage is not the sole directory.
4. Add encrypted production-grade key storage and explicit backup/recovery UX.
5. Define cancellation, dispute, fee, and multi-milestone semantics before extending the private contract model.
6. Conduct independent circuit, contract, event-recovery, and information-leakage reviews.
