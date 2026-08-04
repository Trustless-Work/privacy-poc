# Trustless Work Privacy PoC

A Stellar testnet proof of concept for milestone escrow using Confidential Tokens with USDC as the underlying SEP-41 asset.

## Green Road demo

The application presents the protocol as a privacy-preserving marketplace order. Alberto orders a 25 USDC **Irie Oregano Kit**. Ziggy creates the escrow, Alberto funds it, and Ziggy delivers the product. The escrow then releases the private payment to Buju B. without publishing the order amount or the participants' confidential balances on-chain.

The primary UI tells this story while preserving the real wallet, proof-generation, factory, and contract operations underneath it. Technical wallet, auditor, disclosure, and deployment tools remain available from the role menu.

> [!WARNING]
> This repository evaluates developer-preview cryptography. The Confidential Token circuits and UltraHonk verifier are not production-ready or approved for mainnet. Do not use real value.

## What the PoC proves

The core research question has been answered positively:

> A Soroban escrow contract can act as an authorized confidential spender and atomically release the complete delegated allowance to a fixed receiver without revealing the amount on-chain.

The current implementation demonstrates:

- a one-time protocol deployment with a confidential-token wrapper, verifier, auditor registry, and shared escrow factory;
- wallet-created escrow instances signed through Freighter;
- multiple independent escrows that may reuse the same Payer, Approver, and Receiver addresses;
- private USDC deposit, merge, allowance creation, full release, receipt, merge, and withdrawal;
- a PoC-specific Noir constraint requiring the post-release allowance to equal zero;
- Receiver and Auditor recovery from encrypted `spender_transfer` data;
- durable account reconstruction through Umbra history plus the live Stellar RPC tail;
- cross-source event normalization and logical deduplication;
- owner-visible outgoing escrow history derived from verified allowance checkpoints; and
- selective disclosure for supported holder-generated transfers.

## Privacy boundary

### Public

- participant and contract addresses;
- contract calls and transaction timing;
- escrow lifecycle state;
- public deposits and withdrawals;
- the existence of confidential-token and allowance operations; and
- application-layer order or milestone metadata unless separately protected.

### Confidential

- private receiving and spendable balances;
- confidential allowances;
- internal transfer amounts; and
- the released escrow amount.

A configured Auditor can decrypt supported activity. Privacy therefore means controlled visibility, not anonymity from every participant.

## Current architecture

```text
USDC Stellar Asset Contract
          |
          v
Confidential Token wrapper ---- UltraHonk verifier
          |                     Auditor registry
          |
          +---- private balances and allowances
                         |
                  Escrow instances
                         ^
                  Shared factory
                         ^
                  Green Road app
```

The protocol is deployed once per environment. An Approver then uses the factory through Freighter to deploy and initialize each fresh escrow. The browser retains known escrow IDs and lets users switch the active instance.

Each escrow represents one milestone and follows:

```text
Initialized -> Funded -> Released
```

The escrow never stores or emits a plaintext amount. Funding creates one confidential allowance, and release must exhaust that allowance in the same atomic Soroban transaction.

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

Freighter displays public balances. Private `Receiving` and `Spendable` balances are reconstructed by the application from encrypted protocol events.

## Recovery model

Green Road rebuilds private state from authorized secrets and event history:

1. The wallet derives deployment-bound confidential keys from a deterministic Freighter `signMessage` signature.
2. Umbra supplies durable account-scoped encrypted history when configured.
3. Stellar RPC supplies the recent live event tail.
4. The SDK normalizes and deduplicates events from both sources.
5. The state engine replays events in protocol order.
6. Reconstructed openings are re-committed and checked against live on-chain commitments.

History providers improve availability but are not trusted as balance authorities. A reconstructed state is usable only when its commitments match the token contract.

Outgoing escrow releases are not presented as payer-generated sender proofs. The escrow contract generated the delegated transfer. The payer-visible amount is reconstructed from the earlier `set_spender` owner checkpoint and the full-release invariant, then exposed only when complete replay matches the current on-chain balances.

See [Recovery model](docs/recovery-model.md) for the complete design.

## Repository structure

```text
circuits/                # pinned and PoC-specific Noir circuits
contracts/
  token/                 # OpenZeppelin-based confidential-token wrapper
  verifier/              # UltraHonk verification-key registry
  auditor/               # auditor-key registry
  factory/               # shared factory for fresh escrow instances
  escrow/                # Trustless Work one-milestone escrow
packages/
  sdk/                   # crypto, proving, events, recovery, and escrow adapters
  disclosure/            # selective-disclosure circuits and pinned VKs
  app/                   # Next.js Green Road and technical role interfaces
  indexer/               # Goldsky/Postgres durable global event pipeline
scripts/                  # deployment, build, and end-to-end flows
docs/                     # architecture, runbooks, decisions, risks, and history
```

Start with:

- [Current implementation and testnet runbook](docs/current-implementation-runbook.md)
- [Architecture](docs/architecture.md)
- [Recovery model](docs/recovery-model.md)
- [Contract specification](docs/contract-spec.md)
- [Implementation history](docs/implementation-history.md)
- [Incidents and blockers](docs/incidents-and-blockers.md)
- [Threat model](docs/threat-model.md)
- [USDC strategy](docs/usdc-strategy.md)
- [UI/UX next iteration](docs/ui-ux-next-iteration.md)

## Run locally

Prerequisites: Node.js, pnpm, Rust, Stellar CLI, Freighter, and a configured testnet deployment.

```bash
pnpm install
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

Rebuild the SDK whenever SDK exports, event decoders, or state logic change. If Next.js still loads an older bundle, remove only the generated cache and restart:

```bash
rm -rf packages/app/.next
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

For a brand-new protocol environment:

```bash
pnpm build:contracts
pnpm build:escrow-circuits
pnpm --filter @ctd/sdk exec tsx ../../scripts/deploy.ts
pnpm --filter @ctd/sdk build
pnpm --filter @ctd/app dev
```

Do not rerun the deployment script merely to create another escrow. Use **Create new escrow instance** in the Approver UI; the shared factory creates the contract through Freighter.

## Events and indexing

The SDK currently understands token events including:

- `register`;
- `deposit`;
- `merge`;
- `withdraw`;
- `transfer`;
- `set_spender`;
- `revoke_spender`; and
- `spender_transfer`.

Escrow instances emit `init`, `funded`, and `released` lifecycle events.

Umbra provides account-scoped history used for wallet recovery. The checked-in Goldsky pipeline remains the global durable event path, but it does not yet ingest the spender event family. The factory also lacks an `escrow_deployed` event, so global escrow discovery is not yet indexable.

## Current limitations

- One escrow represents one milestone and releases its complete allowance.
- The payer can revoke an active delegation before release; the escrow then remains unreleased.
- Escrow selection and discovery are browser-local because the factory emits no deployment event.
- Recovery requires the wallet's confidential key and complete compatible history for the relevant account.
- The Goldsky pipeline must be extended for `set_spender`, `revoke_spender`, and `spender_transfer`.
- Deposits, withdrawals, addresses, timing, and transaction graph remain public and may permit correlation.
- Developer-preview circuits, verifier contracts, key handling, and operational recovery require independent security review before production use.

## Validation

The implementation includes:

- Soroban escrow contract tests and snapshots;
- real Noir witness and circuit parity checks;
- full-release rejection tests for partial spending;
- SDK and application TypeScript checks;
- production Next.js builds;
- receiver release-recovery regression tests;
- Umbra parsing and state-recovery tests;
- registration error-classification tests;
- cross-source event deduplication tests; and
- owner-history reconstruction guarded by live commitment matching.

## References

- [Stellar Confidential Tokens developer preview](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar)
- [Reference demo](https://github.com/brozorec/stellar-confidential-token-demo)
- [OpenZeppelin stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts)
- [Trustless Work](https://www.trustlesswork.com/)

## License

MIT. Upstream code retains its original notices and license requirements.
