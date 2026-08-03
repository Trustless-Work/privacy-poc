# Trustless Work Privacy PoC

A Stellar testnet proof of concept for milestone escrow using Confidential Tokens with USDC as the underlying SEP-41 asset.

> [!WARNING]
> This repository evaluates developer-preview cryptography. The Confidential Token circuits and UltraHonk verifier are not production-ready or approved for mainnet. Do not use real value.

## What works today

The PoC now demonstrates the complete confidential escrow lifecycle:

- An Approver can create multiple independent escrow contracts from a shared factory using Freighter.
- The same Payer, Approver, and Receiver addresses can be reused across instances.
- The browser retains an escrow history and lets the user switch the active instance.
- The Payer deposits testnet USDC, merges it into a private spendable balance, and funds an escrow with a confidential allowance.
- The Approver releases the complete allowance atomically.
- The Receiver reconstructs the release from the token's `spender_transfer` event, merges it into private spendable funds, and can withdraw to public USDC.
- An Auditor can decrypt supported confidential activity with the configured auditor key.
- A neo-brutalist UI and guided seven-step walkthrough are available at `/escrow`.

The core research question has been answered positively: an escrow contract can act as an authorized confidential spender and atomically release the complete private allowance to a fixed Receiver without revealing the amount on-chain.

## Confidential balance lifecycle

```text
Public USDC
  -> Deposit
Private Receiving
  -> Merge
Private Spendable
  -> Fund escrow
Private Allowance
  -> Approver release
Receiver Private Receiving
  -> Merge
Receiver Private Spendable
  -> Withdraw
Public USDC
```

`Receiving` and `Spendable` are private balances reconstructed locally from contract events. A successful escrow release does not immediately appear in Freighter: the Receiver must sync, merge, and then withdraw if public USDC is desired.

## Repository structure

```text
contracts/
  token/                # OpenZeppelin-based confidential-token wrapper
  verifier/             # UltraHonk verification-key registry
  auditor/              # auditor-key registry
  factory/              # shared factory for fresh escrow instances
  escrow/               # Trustless Work one-milestone escrow
packages/
  sdk/                  # crypto, proving, event decoding, state, escrow adapters
  disclosure/           # selective-disclosure circuits and pinned VKs
  app/                  # Next.js wallet, escrow, verifier, and auditor UI
  indexer/              # durable confidential-event ingestion and read API
scripts/                # deployment and end-to-end test flows
docs/                   # architecture, decisions, runbooks, risks, and plans
```

Start with:

- [Current implementation and testnet runbook](docs/current-implementation-runbook.md)
- [UI/UX next iteration](docs/ui-ux-next-iteration.md)
- [Architecture](docs/architecture.md)
- [Contract specification](docs/contract-spec.md)
- [Threat model](docs/threat-model.md)
- [USDC strategy](docs/usdc-strategy.md)

## Run locally

Prerequisites: Node.js, pnpm, Rust, Stellar CLI, Freighter, and a configured testnet deployment.

```bash
pnpm install
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

Rebuild the SDK whenever SDK exports or event decoders change. If Next.js still loads an older bundle, remove `packages/app/.next` and restart the app.

For a brand-new protocol deployment:

```bash
pnpm build:contracts
pnpm build:escrow-circuits
pnpm --filter @ctd/sdk exec tsx ../../scripts/deploy.ts
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

The full deployment script is for new environments. Do not rerun it merely to create another escrow: doing so replaces shared contract IDs and separates the new app configuration from existing registrations and private state. New escrows are created through the shared factory in the Approver UI.

## Events and indexing

The confidential-token contract emits events including `register`, `deposit`, `merge`, `withdraw`, `transfer`, and `spender_transfer`. Escrow instances emit `init`, `funded`, and `released`.

The SDK/RPC recovery path decodes `spender_transfer`, credits the Receiver's private `Receiving` balance, and performs a versioned one-time backfill for browser caches that had already advanced past a release. The checked-in Goldsky pipeline does not yet ingest `spender_transfer`; durable indexer support remains a priority.

The factory also lacks an `escrow_deployed` event. Until that is added, escrow discovery is browser-local rather than globally indexable.

## Current limitations

- One escrow represents one milestone and releases its full allowance.
- Escrow selection/history is stored in the browser; there is no cross-device discovery or import flow yet.
- Private state depends on event availability and locally held confidential keys.
- The Goldsky pipeline must be extended for `spender_transfer`.
- The factory needs an `escrow_deployed` event for complete instance discovery.
- Developer-preview cryptography, circuits, and verifier contracts require further security review before production use.

## Validation

The working iteration was validated with SDK and app TypeScript checks, a production Next.js build, the fast cryptography/escrow suite, and dedicated release-recovery regression coverage. The release recovery verifies exact commitment reconstruction and prevents double-crediting during historical backfill.

## Next iteration

The next iteration focuses on UI and user experience: stronger active-wallet and active-escrow context, clearer private balance explanations, transaction/proof progress, state-aware journey guidance, human-readable escrow labels, import/discovery, and actionable diagnostics. See the [UI/UX plan](docs/ui-ux-next-iteration.md).

## References

- [Stellar Confidential Tokens developer preview](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar)
- [Reference demo](https://github.com/brozorec/stellar-confidential-token-demo)
- [OpenZeppelin stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts)
- [Trustless Work](https://www.trustlesswork.com/)

## License

MIT. Upstream code retains its original notices and license requirements.
