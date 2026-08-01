# Initial Threat Model

This document defines the minimum adversarial cases for the PoC. It is not an audit.

| Threat | Expected control |
|---|---|
| Release before approval | Escrow state transition rejects release |
| Amount substitution | Proof binds transfer amount to milestone commitment |
| Receiver substitution | Receiver is a public input bound to escrow and proof |
| Replay across milestones/escrows | Domain-separated escrow ID, milestone ID, chain, and nonce |
| Allowance reuse/overspend | Confidential allowance state and nonce are consumed exactly once |
| Malicious release signer | Signer can authorize timing, not change amount or receiver |
| Malicious approver | Cannot release alone; separate release-signer authorization remains required |
| Indexer tampering | Client verifies reconstructed openings against on-chain commitments |
| RPC history expiry | Durable indexer preserves the full required event history |
| Local-state loss | Documented encrypted backup/recovery or indexed reconstruction |
| Auditor-key compromise | Rotation procedure, scoped keys where supported, incident disclosure |
| Public deposit/withdraw correlation | Product warning and batching/retention analysis; no anonymity claims |
| Mock asset confused with USDC | Explicit symbol/name, manifest metadata, UI warning, testnet-only guard |
| Upstream circuit/verifier flaw | Testnet only, pinned dependencies, audits required before production |

## Security invariants

1. Value cannot be created by escrow operations.
2. A milestone can produce at most one successful release.
3. Only the configured receiver can receive the release.
4. Released value equals the privately committed milestone value.
5. The public lifecycle never emits or stores the plaintext amount.
6. Cancellation cannot coexist with a successful release.
7. Auditor access does not grant spending authority.
8. Selective disclosure reveals only the statement authorized by the holder.

## Privacy limitations

The PoC hides balances and internal transfer amounts. It does not hide sender/receiver addresses, contract calls, deposits, withdrawals, timings, IP metadata, wallet metadata, or application-layer milestone content. Deposits and withdrawals may allow amount correlation.
