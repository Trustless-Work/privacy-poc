# USDC Strategy

## Decision

Design and test the PoC around USDC, not native XLM.

XLM is still required for Stellar account activation and transaction fees, but it is not the escrow asset exposed by the product flow.

## Selected testnet asset

The first PoC deployment uses the Stellar testnet USDC asset documented by Stellar:

| Field | Value |
|---|---|
| Asset code | `USDC` |
| Issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| SEP-41 SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Decimals | 7 |
| Network | Stellar testnet |
| Verified | 2026-08-01 |
| Source | [Stellar x402 documentation](https://developers.stellar.org/docs/build/agentic-payments/x402) |

The deployment script resolves the SAC from the asset code and issuer and aborts if the resulting contract does not match the documented SAC. Users still need testnet XLM for fees and a USDC trustline/balance for deposits.

## Fallback order

1. The selected testnet USDC SAC above.
2. A dedicated `MockUSDC` SEP-41 token with 7 decimals if the public test asset becomes unavailable after a testnet reset.
3. Native XLM only as a temporary protocol diagnostic, never as the accepted PoC asset.

## Why the fallback is necessary

Testnet assets can change after network resets. The identifier is intentionally pinned together with its authoritative source and a runtime SAC derivation check. Any future change requires a reviewed update to both this document and the deployment manifest.

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
