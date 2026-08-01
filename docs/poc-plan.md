# Proof-of-Concept Plan

## Phase 0 — Pin and reproduce

Goal: establish a known-good upstream baseline.

- Record the reference demo commit SHA and OpenZeppelin dependency commit.
- Import the monorepo with original license notices.
- Build contracts and SDK.
- Run register → deposit → merge → transfer → withdraw on Stellar testnet.
- Verify auditor decryption and selective disclosure.
- Record proof generation time, transaction fees, payload sizes, and failure behavior.

Exit criteria: the unchanged reference flow is reproducible from a clean checkout.

## Phase 1 — USDC-compatible asset

Goal: replace native XLM as the wrapped value-bearing asset.

- Confirm whether a supported testnet USDC SAC is available for this preview.
- Otherwise deploy `MockUSDC` as an SEP-41-compatible test asset with 7 decimals.
- Parameterize deployment scripts with the underlying token contract ID.
- Assert decimals, authorization behavior, deposit, and withdrawal.
- Keep XLM only for account funding and transaction fees.

Exit criteria: the full confidential-token demo runs against USDC or the documented mock without amount-unit drift.

## Phase 2 — Delegated spender spike

Goal: prove that a Soroban contract can safely spend a confidential allowance.

- Register a minimal test spender contract.
- Create confidential allowance from payer to spender.
- Invoke delegated transfer through the spender.
- Validate allowance exhaustion, nonce behavior, cancellation/reclaim, and unauthorized calls.
- Capture all required proof inputs and on-chain events.

Exit criteria: delegated transfer succeeds once and all replay/overspend tests fail.

## Phase 3 — One-milestone escrow

Goal: cryptographically couple Trustless Work approval to the confidential release.

- Implement payer, receiver, approver, release signer, and auditor configuration.
- Store milestone amount commitment.
- Bind proof to escrow, milestone, receiver, allowance state, and release nonce.
- Implement initialize, confirm funding, approve, release, cancel, and reclaim.
- Emit lifecycle events without plaintext amounts.
- Add positive and adversarial end-to-end tests.

Exit criteria: exactly one approved confidential payment can be released to the configured receiver for the committed amount.

## Phase 4 — Operational proof

Goal: test whether the design is usable and recoverable.

- Integrate complete event indexing.
- Restore payer and receiver state from a fresh browser profile using indexed history.
- Add auditor and selective-disclosure views.
- Measure proof time on representative desktop and mobile hardware.
- Document key backup, auditor-key rotation, and incident paths.

Exit criteria: a second operator can reproduce the PoC and recover state using only documented prerequisites and authorized secrets.

## Explicitly out of scope

- Mainnet or real-value use;
- multi-milestone and partial release;
- production Trustless Work v2 changes;
- hiding addresses or transaction graph;
- legal claims of anonymity or compliance;
- production key management;
- platform fees until private amount binding is proven.

## Decision log required

Create an ADR before changing any of these assumptions:

- selected underlying USDC/test asset;
- circuit modification vs. separate equality proof;
- escrow custody/allowance semantics;
- cancellation and dispute recovery;
- indexer provider and retention guarantees;
- auditor ownership and key rotation.
