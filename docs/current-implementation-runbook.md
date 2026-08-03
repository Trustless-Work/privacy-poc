# Current implementation and testnet runbook

Last updated: August 3, 2026.

This document is the operational handoff for the working Trustless Work Privacy PoC. It describes the deployed model, the successful end-to-end flow, recovery behavior, and the safety rules that prevent test state from being accidentally split across deployments.

## System at a glance

The protocol is deployed once per environment. It consists of a confidential-token wrapper, verifier, auditor registry, shared escrow factory, and individually deployed escrow instances.

The factory creates a fresh contract for every escrow. Participants are not globally limited to one escrow: the same Payer, Approver, and Receiver addresses may be used in any number of independent instances, provided the roles satisfy the contract's rules.

The frontend stores known escrow IDs per confidential-token deployment and exposes a selector on the role pages. Creating a new instance appends to that history instead of overwriting the previous escrow. Switching instances disconnects the previous controller so a transaction cannot accidentally be submitted to the formerly selected contract.

## Roles

| Role | Responsibility |
|---|---|
| Payer | Registers, deposits, merges, and funds the escrow with a private allowance |
| Approver | Creates and initializes escrow instances, then authorizes full release |
| Receiver | Reconstructs the incoming release, merges it, and optionally withdraws public USDC |
| Auditor | Decrypts supported confidential activity with the configured auditor key |
| Escrow contract | Acts as the authorized spender for exactly the delegated allowance |

## Successful seven-step flow

1. Prepare three Freighter accounts for Payer, Approver, and Receiver.
2. Register the Payer and Receiver against the current confidential-token deployment.
3. Deposit testnet USDC for the Payer. The deposit first appears in private `Receiving`.
4. Merge the Payer's receiving balance into private `Spendable`.
5. From the Approver page, create a fresh escrow instance and initialize the fixed roles. Reusing addresses from an earlier escrow is allowed.
6. From the Payer page, fund the selected escrow. Funding creates a confidential allowance controlled by that escrow contract.
7. From the Approver page, generate and submit the full-release proof. The Receiver then syncs events, sees the amount in private `Receiving`, merges it into private `Spendable`, and withdraws only if public USDC in Freighter is desired.

## Release semantics

Release is atomic. The escrow cannot enter `Released` if the confidential delegated transfer fails.

The token emits `spender_transfer` for an escrow release rather than an ordinary `transfer`. Its topics identify the spender, Payer, and Receiver; its encrypted fields allow the Receiver and configured Auditor to reconstruct the amount without revealing it publicly.

The SDK now:

- recognizes and decodes `spender_transfer`;
- decrypts the Receiver amount using the deployed OpenZeppelin event shape;
- adds the opening to the Receiver's local `Receiving` balance;
- exposes the release in wallet and auditor activity;
- performs a one-time historical replay for legacy caches that skipped this event type; and
- deduplicates overlap between backfill and incremental scanning.

This is why a previously released escrow can become recoverable after pulling the fix and clicking **Sync from RPC events**. No second release or contract redeployment is required.

## Balance interpretation

| State | Meaning | Next action |
|---|---|---|
| `Receiving > 0` | Funds arrived privately | Merge |
| `Receiving = 0`, `Spendable > 0` | Funds are available privately | Use privately or withdraw |
| Both `0`, state matches chain | No recoverable balance exists for this account/deployment | Verify Receiver and selected deployment |
| Both `0`, state mismatch | Local opening and on-chain commitment disagree | Sync and inspect the diagnostic log; do not clear state |

Freighter displays public asset balances, not the PoC's reconstructed private balances. Merge remains private. Withdraw is the step that returns funds to public USDC.

## Daily startup

Pull the latest `main`, rebuild the SDK, and start the app:

```bash
git switch main
git pull origin main
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

If Next.js reports that an exported SDK function is not a function, stop the server and rebuild the SDK. If necessary, clear only the generated Next.js cache:

```bash
rm -rf packages/app/.next
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

Do not clear browser storage during private-state diagnosis. It contains local state reconstruction data and the browser-local escrow history.

## Creating additional escrows

Use **Create new escrow instance** on the Approver page. Enter the Payer and Receiver, approve the deployment and initialization requests in Freighter, and verify that the new `C...` contract appears in the escrow selector.

Do not run `scripts/deploy.ts` to create another escrow. The shared protocol remains fixed; only the factory deploys the new instance.

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

If the local artifact is stale, rebuild contracts before doing anything on-chain. If only the deployed factory is stale, deploy a new factory using the current factory WASM and the existing deployment's constructor inputs, then update only `NEXT_PUBLIC_FACTORY_CONTRACT_ID`.

Do not replace the token, verifier, auditor, or start-ledger values during a factory-only upgrade. Existing escrows continue to exist independently of the factory that created them.

## Deployment safety rules

- Do not rerun the full protocol deployment to create an escrow.
- Do not redeploy while diagnosing Receiver visibility.
- Do not release the same business payment again because the UI is empty.
- Do not clear browser storage before exporting or intentionally abandoning its private state.
- Confirm the active deployment, escrow ID, role, and Freighter address before every state-changing transaction.
- Rebuild `@ctd/sdk` after pulling SDK source changes.
- Rebuild contract WASM after pulling Rust contract changes; source changes do not update an existing artifact automatically.

## Events

| Source | Relevant events | Current use |
|---|---|---|
| Confidential token | `register`, `deposit`, `merge`, `withdraw`, `transfer`, `spender_transfer` | Local state reconstruction, wallet activity, audit views |
| Escrow instance | `init`, `funded`, `released` | Escrow lifecycle and diagnostics |
| Factory | No deployment event yet | New instance returned directly to the creating browser |

The SDK's RPC/hybrid path supports `spender_transfer`. The checked-in Goldsky pipeline still needs explicit ingestion and normalized storage for this event. Until then, durable recovery depends on RPC history being available or another indexer serving the event.

For complete multi-escrow discovery, add an `escrow_deployed` factory event containing at least the new escrow address and useful deployment context. An indexer can then discover instances from one factory and join their lifecycle events with confidential-token transfers.

## Verified incidents and resolutions

### `deployEscrow is not a function`

Cause: the app loaded an older compiled SDK bundle. Resolution: rebuild `@ctd/sdk`, clear `.next` only if required, and restart.

### `trying to invoke non-existent contract function: deploy_escrow`

Cause: the configured on-chain factory and initially the local WASM predated the factory entry point. Resolution: rebuild the current factory artifact, deploy only the upgraded factory, and change only the factory contract ID.

### Receiver remained empty after `Released`

Cause: the token emitted `spender_transfer`, while the wallet scanner recognized only `transfer`. Resolution: decode/apply the delegated-transfer event and migrate old browser caches with a one-time deduplicated backfill.

## Validation completed

- SDK, app, and indexer TypeScript checks.
- Production Next.js build.
- Fast cryptography and escrow test suite.
- Dedicated release-recovery regression checks.
- Exact Receiver commitment reconstruction after release.
- One-time legacy-cache recovery without double-credit.

## Known limitations

- One escrow instance represents one milestone and releases its complete allowance.
- Escrow history and selection remain browser-local.
- The factory emits no discovery event.
- The Goldsky pipeline does not yet durably ingest `spender_transfer`.
- Private-state recovery depends on keys plus complete relevant event history.
- Contracts, circuits, and verifier remain developer-preview technology and require production-grade audit work.

## Recommended next technical work

1. Add `spender_transfer` to the durable indexer pipeline and verify parity with RPC decoding.
2. Add `escrow_deployed` to the factory and index factory/escrow lifecycle events.
3. Build escrow import/discovery so browser state is not the sole directory.
4. Keep the protocol stable while completing the UI/UX iteration described in [UI/UX next iteration](ui-ux-next-iteration.md).
