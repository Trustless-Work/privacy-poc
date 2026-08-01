# Contracts workspace

This directory will be imported from the reference demo as a separate Rust/Soroban workspace, then extended with `escrow/`.

Planned contracts:

- `confidential-token/`: USDC-compatible Confidential Token wrapper;
- `verifier/`: UltraHonk verification-key registry;
- `auditor/`: auditor-key registry;
- `escrow/`: one-milestone Trustless Work integration;
- `mock-usdc/`: test-only SEP-41 fallback when testnet USDC is unavailable.

Do not copy production Trustless Work v2 contracts into this PoC. Shared concepts should be adapted explicitly and reviewed as a separate security domain.
