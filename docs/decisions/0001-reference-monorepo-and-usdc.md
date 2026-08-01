# ADR 0001: Reuse the reference monorepo and target USDC

- Status: Accepted
- Date: 2026-08-01

## Context

The Stellar Confidential Token developer preview already provides working Soroban contracts, Noir/UltraHonk proof integration, a TypeScript SDK, selective disclosure, a Next.js demo, and optional indexing. Trustless Work needs to evaluate confidential milestone releases, not rebuild the base protocol.

The production Trustless Work product primarily settles in USDC. A native-XLM-only PoC would validate cryptography but leave material asset-integration risk unresolved.

## Decision

- Reuse the structure and relevant source from `brozorec/stellar-confidential-token-demo` at a pinned commit.
- Preserve upstream notices and isolate Trustless Work-specific changes.
- Add a separate one-milestone escrow contract rather than modify production v2.
- Target USDC as the underlying SEP-41 asset.
- Use a clearly identified 7-decimal mock only when a suitable testnet USDC SAC is unavailable.
- Use XLM only for network fees and test-account funding.

## Consequences

- The PoC starts from a working protocol and focuses engineering on delegated spending and milestone binding.
- Upstream changes must be tracked and selectively incorporated.
- A circuit change may be required to bind transfer proofs to Trustless Work escrow context.
- Results remain testnet-only until circuits, verifier, contracts, operational recovery, and key management are independently audited.
