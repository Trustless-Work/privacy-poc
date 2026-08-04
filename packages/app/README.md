# @ctd/app — Green Road confidential escrow front end

The Next.js browser application for the [Trustless Work Privacy PoC](../../README.md). It combines a scenario-first marketplace journey with the real Confidential Token wallet, factory, escrow, Auditor, and selective-disclosure operations.

## Current routes

- **`/`** — Green Road marketplace landing page.
- **`/escrow`** — guided one-milestone order journey.
- **`/escrow/approver`** — create fresh escrow instances through the shared factory, initialize fixed roles, and submit the atomic full release.
- **`/escrow/payer`** — connect the configured Payer and fund the selected escrow with one private allowance.
- **`/escrow/receiver`** — inspect the selected escrow and continue to Receiver history, merge, and withdrawal.
- **`/wallet`** — connect Freighter, derive confidential keys, register, deposit, merge, transfer, withdraw, sync, and inspect owner-visible history.
- **`/auditor`** — decrypt supported activity with the configured Auditor key.
- **`/verify`** — create and verify supported selective-disclosure requests.
- **`/advanced`** — configure alternate Confidential Token deployments.
- **`/admin`** — token and compliance-policy administration tools.

## Factory-based escrow flow

The app no longer assumes one singleton escrow.

1. The protocol is deployed once and exposes a shared factory.
2. An Approver enters Payer and Receiver addresses.
3. Freighter signs the factory `deploy_escrow` transaction.
4. The app receives the fresh escrow contract address.
5. The browser generates registration material bound to that address.
6. Freighter signs initialization.
7. The new escrow is appended to browser-local history and selected as active.

The top navigation exposes an **Escrow** selector. The same participant addresses may be reused in multiple independent contracts.

Creating another escrow does not require rerunning `scripts/deploy.ts`.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

The app is available at `http://localhost:3000`.

The app imports the compiled SDK. After SDK source changes, rebuild it. If Next.js still loads stale exports:

```bash
rm -rf packages/app/.next
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

## Deployment configuration

`scripts/deploy.ts` writes the protocol manifest to `packages/app/.env.local` after a successful testnet deployment.

Expected values include:

```text
NEXT_PUBLIC_TOKEN_CONTRACT_ID=C...
NEXT_PUBLIC_VERIFIER_CONTRACT_ID=C...
NEXT_PUBLIC_AUDITOR_CONTRACT_ID=C...
NEXT_PUBLIC_UNDERLYING_CONTRACT_ID=C...
NEXT_PUBLIC_FACTORY_CONTRACT_ID=C...
NEXT_PUBLIC_DEPLOYED_AT_LEDGER=123456
NEXT_PUBLIC_AUDITOR_ID=0
NEXT_PUBLIC_AUDITOR_SECRET_HEX=0x...
```

A legacy/fallback `NEXT_PUBLIC_ESCROW_CONTRACT_ID` may exist, but normal current usage creates and selects escrows through the factory.

Never expose a production Auditor secret through `NEXT_PUBLIC_*` configuration. The current value is demo-only.

## Confidential key derivation

The wallet derives its confidential secret deterministically from a Freighter `signMessage` signature over a deployment-bound message.

Consequences:

- the same Freighter account can rederive the same confidential key for the same token deployment;
- a different token deployment derives a different key;
- authorized recovery can work on another compatible origin when complete history exists; and
- the current `localStorage` cache is convenient but not production-grade key custody.

## Event history and recovery

Balances are reconstructed by the SDK `StateEngine` from encrypted protocol events.

Green Road uses:

- **Umbra account history** for durable account-scoped recovery;
- **Stellar RPC** for current reads and the recent live tail; and
- an optional **Goldsky indexer** for global durable history.

Configure Umbra:

```bash
# packages/app/.env.local
NEXT_PUBLIC_UMBRA_URL=https://your-umbra-api.example
```

The public demo defaults to the configured public Umbra deployment in `lib/deployment.ts`.

Configure the optional global indexer:

```bash
# packages/app/.env.local
NEXT_PUBLIC_INDEXER_URL=https://confidential-token-indexer.<account>.workers.dev
```

The checked-in Goldsky pipeline does not yet ingest `set_spender`, `revoke_spender`, or `spender_transfer`, so Umbra is the preferred recovery source for the current escrow flow.

### Recovery algorithm

When Umbra is available, each sync:

1. fetches account history from the deployment ledger;
2. normalizes Umbra and RPC event identities;
3. deduplicates by cursor and logical payload identity;
4. replays account state from zero;
5. applies the current RPC tail without overlap; and
6. checks reconstructed openings against the live on-chain commitments.

The history provider is not trusted as balance authority.

### Owner-visible escrow history

`set_spender` provides an owner-encrypted post-funding spendable checkpoint. The wallet derives the allowance from the verified balance transition.

A later `spender_transfer` is paired with that allowance. Since the PoC enforces complete allowance exhaustion, the Payer can see the release amount in local history.

This does not give the Payer a normal sender selective-disclosure proof. The escrow contract generated the delegated transfer's ephemeral cryptography, so the UI labels this path **reconstructed from allowance** and **spender proof only**.

See [Recovery model](../../docs/recovery-model.md).

## Browser-local state

The app currently persists:

- derived confidential key cache;
- reconstructed private openings;
- sync cursor and cache version;
- known escrow IDs per token deployment; and
- active escrow selection.

Do not clear browser storage as a first troubleshooting action. Umbra may recover balances, but prior escrow IDs are not globally discoverable because the factory emits no `escrow_deployed` event.

## Cross-origin isolation

Browser proving needs `window.crossOriginIsolated === true` because bb.js uses `SharedArrayBuffer` and Web Workers.

The app sets:

- `Cross-Origin-Opener-Policy: same-origin`; and
- `Cross-Origin-Embedder-Policy: credentialless`.

`credentialless` is intentional because the browser must fetch the Stellar testnet RPC without requiring resource-side CORP headers.

## Deploy

The app deploys to Cloudflare Workers through `@opennextjs/cloudflare`:

```bash
pnpm --filter @ctd/app deploy:cf
```

Configuration lives in `wrangler.jsonc` and `open-next.config.ts`.

## Critical: bb.js must not be webpack-bundled

bb.js's browser distribution declares a top-level webpack runtime symbol and creates its WASM worker through a stable relative URL. Bundling it into a hashed Next.js client chunk breaks worker resolution and may cause proof generation to hang.

The current solution is load-bearing:

1. `scripts/vendor-bb.mjs` copies `@aztec/bb.js` browser assets into `public/vendor/bb/` during `predev` and `prebuild`.
2. The client webpack configuration aliases the bare `@aztec/bb.js` specifier to `false`.
3. `lib/bb-loader.ts` configures the SDK to import `/vendor/bb/index.js` as native ESM at runtime.
4. The loader remains lazy because Cloudflare Workers reject top-level eval-like behavior.

Do not simplify this path without validating an actual browser proof and production build.

## Validation

```bash
pnpm --filter @ctd/sdk typecheck
pnpm --filter @ctd/sdk test:fast
pnpm --filter @ctd/app build
```

For recovery or event changes, also run the focused SDK checks listed in [AGENTS.md](AGENTS.md).

## Current limitations

- one escrow contract represents one milestone;
- full allowance release only;
- Payer revocation remains possible before release;
- browser-local escrow discovery;
- incomplete global indexer coverage for spender events;
- public addresses, timing, deposits, withdrawals, and transaction graph;
- browser-local demo key caching; and
- developer-preview cryptography without production audit approval.
