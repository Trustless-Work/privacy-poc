# Trustless Work Privacy PoC

A testnet proof of concept for milestone escrow using Stellar Confidential Tokens with USDC as the intended underlying SEP-41 asset.

> [!WARNING]
> This repository evaluates developer-preview cryptography. The Confidential Token circuits and UltraHonk verifier are not production-ready or approved for mainnet. Do not use real value.

## Research question

Can a Trustless Work escrow contract securely spend a payer's confidential delegated allowance while cryptographically binding the hidden transfer amount to the approved milestone?

## Scope

The first PoC implements one milestone and known counterparties.

- **Public:** payer and receiver addresses, escrow roles, lifecycle status, approvals, and timestamps.
- **Confidential:** escrow amount, milestone amount, internal transfer amount, and confidential balances.
- **Controlled disclosure:** a designated auditor can decrypt amounts, and the receiver can selectively prove a specific payment.

## Architecture

This repository reuses the package boundaries and protocol implementation from [brozorec/stellar-confidential-token-demo](https://github.com/brozorec/stellar-confidential-token-demo), while adding a Trustless Work escrow integration as a separate contract and SDK module.

```text
contracts/
  confidential-token/   # upstream OpenZeppelin-based wrapper integration
  verifier/             # UltraHonk verification-key registry
  auditor/              # auditor-key registry
  escrow/               # Trustless Work one-milestone escrow PoC
packages/
  sdk/                  # crypto, proving, chain, state, escrow adapters
  disclosure/           # selective-disclosure circuits and pinned VKs
  app/                  # Next.js demo for payer, receiver, approver, auditor
  indexer/              # durable confidential-event ingestion and read API
scripts/                # deployment and end-to-end test flows
docs/                   # architecture, decisions, risks, and PoC plan
```

See [Architecture](docs/architecture.md), [PoC Plan](docs/poc-plan.md), [USDC Strategy](docs/usdc-strategy.md), and [Threat Model](docs/threat-model.md).

## Intended flow

1. Payer and receiver register confidential accounts.
2. Payer deposits testnet USDC into the Confidential Token wrapper.
3. Payer merges the receiving balance into spendable state.
4. Payer commits to a private milestone amount and delegates a confidential allowance to the escrow.
5. Approver marks the milestone approved.
6. Release signer submits a proof-bound release.
7. Escrow calls the confidential delegated transfer to the receiver.
8. Receiver reconstructs the incoming opening and can selectively disclose the payment.
9. Auditor can decrypt the amount using the registered auditor key.
10. An unused allowance can be reclaimed only through a valid cancellation or terminal dispute path.

## USDC-first policy

The PoC targets USDC semantics and 7-decimal Stellar amounts from the beginning. The preferred integration is a testnet USDC Stellar Asset Contract if an appropriate issuer and asset are available. If not, development uses a clearly named mock SEP-41 token configured with USDC-compatible decimals and behavior. Native XLM is used only for Stellar network fees and test-account funding.

No token contract or asset ID is canonical until recorded in a reviewed deployment manifest.

## Go/no-go gate

Before building a complete UI, the contract spike must prove all of the following:

- A Soroban escrow contract can act as the authorized confidential spender.
- The payer cannot overspend or reuse an allowance.
- The released hidden amount is cryptographically equal to the committed milestone amount.
- The proof is bound to escrow ID, milestone ID, receiver, and current allowance state.
- Replay, receiver substitution, amount substitution, and release-before-approval fail.
- Cancellation safely returns or unlocks unused confidential value.
- Receiver state can be recovered from indexed history.
- Auditor decryption and receiver selective disclosure both work.

If amount-to-milestone binding requires modifying upstream Noir circuits, that change is isolated and documented before broader Trustless Work contract integration.

## Status

Repository scaffold and technical documentation. Protocol code will be imported from the reference demo at a pinned commit in the next implementation step.

## References

- [Stellar Confidential Tokens developer preview](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar)
- [Reference demo](https://github.com/brozorec/stellar-confidential-token-demo)
- [OpenZeppelin stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts)
- [Trustless Work](https://www.trustlesswork.com/)

## License

MIT. Upstream code retains its original notices and license requirements.
