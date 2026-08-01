# Trustless Work Privacy PoC

A testnet proof of concept for milestone escrow using Stellar Confidential Tokens with USDC as the intended underlying SEP-41 asset.

> [!WARNING]
> This repository evaluates developer-preview cryptography. The Confidential Token circuits and UltraHonk verifier are not production-ready or approved for mainnet. Do not use real value.

## Research question

Can one approver atomically release an entire confidential USDC allowance to one receiver without revealing its amount on-chain?

## Scope

The first PoC implements one escrow, treated as one milestone, with known counterparties.

- **Public:** payer and receiver addresses, escrow roles, lifecycle status, approvals, and timestamps.
- **Confidential:** escrow amount, milestone amount, internal transfer amount, and confidential balances.
- **Controlled disclosure:** a designated auditor can decrypt amounts, and the receiver can selectively prove a specific payment.

## Architecture

This repository reuses the package boundaries and protocol implementation from [brozorec/stellar-confidential-token-demo](https://github.com/brozorec/stellar-confidential-token-demo), while adding a Trustless Work escrow integration as a separate contract and SDK module.

```text
contracts/
  token/                # upstream OpenZeppelin-based wrapper integration
  verifier/             # UltraHonk verification-key registry
  auditor/              # auditor-key registry
  escrow/               # Trustless Work one-milestone escrow PoC
packages/
  sdk/                  # crypto, proving, chain, state, escrow adapters
  disclosure/           # selective-disclosure circuits and pinned VKs
  app/                  # imported Next.js wallet, verifier, and auditor demo
  indexer/              # durable confidential-event ingestion and read API
scripts/                # deployment and end-to-end test flows
docs/                   # architecture, decisions, risks, and PoC plan
```

See [Contract Specification](docs/contract-spec.md), [Architecture](docs/architecture.md), [PoC Plan](docs/poc-plan.md), [USDC Strategy](docs/usdc-strategy.md), and [Threat Model](docs/threat-model.md).

## Intended flow

1. Payer and receiver register confidential accounts.
2. Payer deposits testnet USDC into the Confidential Token wrapper.
3. Payer merges the receiving balance into spendable state.
4. Payer calls the escrow's `fund` entry point, which atomically delegates the complete private escrow amount as one confidential allowance.
5. Approver submits one approval-and-release transaction with an allowance-exhaustion proof.
6. Escrow atomically calls the confidential delegated transfer to the configured receiver.
7. Receiver reconstructs the incoming opening and can selectively disclose the payment.
8. Auditor can decrypt the amount using the registered auditor key.

## USDC asset

The deployment path now targets Stellar testnet USDC: issuer `GBBD47…LFLA5`, SEP-41 SAC `CBIELT…QDAMA`, and 7-decimal base units. The deployment script derives the SAC from the asset and aborts on an identifier mismatch. Native XLM is used only for test-account funding and network fees. See [USDC Strategy](docs/usdc-strategy.md) for the complete manifest and source.

## Go/no-go gate

Before building a complete UI, the contract spike must prove all of the following:

- A Soroban escrow contract can act as the authorized confidential spender.
- The payer cannot overspend or reuse an allowance.
- The PoC's modified spender-transfer proof enforces that the post-transfer allowance balance is zero.
- The configured receiver and current allowance state are bound to the authorized invocation and proof.
- Replay, receiver substitution, amount substitution, and release-before-approval fail.
- Receiver state can be recovered from indexed history.
- Auditor decryption and receiver selective disclosure both work.

The intended circuit change is deliberately narrow: add a zero-remaining-allowance constraint to the upstream `SpenderTransfer` circuit in this dedicated PoC deployment. The allowance itself is the committed one-milestone amount, so v0 needs no separate amount commitment.

## Status

The pinned reference monorepo is imported. The branch now includes the three-entry-point escrow contract, delegated-spending SDK witnesses and XDR submitters, the pinned `SetSpender` funding circuit, a PoC-specific full-release Noir circuit, compiled browser proving artifacts and packed verifier keys, USDC-first deployment configuration, contract/circuit adversarial tests, and a guided six-step escrow walkthrough at `/escrow`. Connecting the walkthrough actions to a fresh integrated USDC testnet deployment remains pending.

## References

- [Stellar Confidential Tokens developer preview](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar)
- [Reference demo](https://github.com/brozorec/stellar-confidential-token-demo)
- [OpenZeppelin stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts)
- [Trustless Work](https://www.trustlesswork.com/)

## License

MIT. Upstream code retains its original notices and license requirements.
