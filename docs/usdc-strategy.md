# USDC Strategy

## Decision

Design and test the PoC around USDC, not native XLM.

XLM is still required for Stellar account activation and transaction fees, but it is not the escrow asset exposed by the product flow.

## Preferred asset order

1. A supported Circle-issued or otherwise authoritative testnet USDC asset exposed through a Stellar Asset Contract and compatible with the Confidential Token preview.
2. A dedicated `MockUSDC` SEP-41 token deployed for the PoC with 7 decimals and explicit test-only naming.
3. Native XLM only as a temporary protocol-diagnostic fallback, never as the accepted Phase 1 result.

## Why the fallback is necessary

USDC availability, issuers, and testnet asset identifiers can change. The repository must not hard-code an unverified asset ID copied from an old guide. Deployment scripts will require the underlying token contract ID, and reviewed manifests will record the network, issuer, asset code, SAC ID, deployment date, and source used to verify it.

## Amount rules

- Use integer base units throughout contracts and proofs.
- Use 7 decimals for Stellar USDC-compatible units.
- Never use JavaScript floating-point numbers for token arithmetic.
- Display conversion belongs in UI helpers only.
- Test boundary cases: zero, one stroop-equivalent unit, maximum supported value, rounding display, and invalid decimal input.

## Configuration contract

Expected environment variables after implementation:

```text
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=
STELLAR_NETWORK_PASSPHRASE=
UNDERLYING_TOKEN_CONTRACT_ID=
CONFIDENTIAL_TOKEN_CONTRACT_ID=
VERIFIER_CONTRACT_ID=
AUDITOR_REGISTRY_CONTRACT_ID=
ESCROW_CONTRACT_ID=
```

Secrets and private keys must never be committed. Contract IDs are public but must be scoped by network in deployment manifests.

## Acceptance tests

- Deposit and withdrawal conserve exact integer units.
- Confidential transfer conserves value.
- UI displays the correct 7-decimal amount.
- Wrong-decimal configuration fails early.
- Unauthorized mint/freeze operations fail.
- A testnet manifest cannot be loaded under a different network passphrase.
