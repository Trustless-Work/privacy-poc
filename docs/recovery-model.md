# Confidential state recovery model

Last updated: August 4, 2026.

## Purpose

The Confidential Token contract stores commitments, not plaintext balance openings. An authorized wallet must reconstruct its private state from encrypted event history and prove that the resulting openings match the contract.

This document defines the current Green Road recovery model, its trust assumptions, and the distinction between direct decryption, owner-visible history, and selective-disclosure proof authority.

## Core invariant

A reconstructed private state is usable only when:

```text
Commit(spendable_value, spendable_blinding) == on_chain_spendable_commitment
and
Commit(receiving_value, receiving_blinding) == on_chain_receiving_commitment
```

History providers are therefore availability dependencies, not balance authorities.

## Confidential state

For each account, the client reconstructs:

```text
registered
spendable = { value, blinding }
receiving = { value, blinding }
synced ledger
RPC cursor
cache version
```

The chain stores the corresponding Pedersen commitments and public account configuration.

## Key derivation

The browser derives the confidential secret from a Freighter `signMessage` signature over a deployment-bound message.

Properties:

- Ed25519 signatures are deterministic for the same wallet and message.
- The Confidential Token contract address is included in the key domain.
- The same Freighter account derives different confidential keys for different token deployments.
- A user can rederive the same key on another compatible origin by signing the same deployment-bound message.
- The current app caches derived material in browser storage for convenience; this is not a production custody design.

Possession of the Freighter account is necessary but not sufficient for recovery. Compatible encrypted history must also remain available.

## Event sources

### Umbra account history

Umbra exposes account-scoped history:

```text
/v1/ct/:token/history/:address
```

It supplies encrypted events relevant to one account across the deployment history.

Current use:

- primary durable wallet-recovery source;
- replayed from the deployment ledger on every sync; and
- used to rebuild stale or partial browser state from zero.

Umbra payloads are untrusted. Events are decoded, normalized, replayed, and checked against chain commitments.

### Stellar RPC

RPC supplies:

- live contract reads;
- the recent event tail;
- current balance commitments; and
- current escrow and delegation state.

RPC event retention is finite. It cannot by itself guarantee recovery of an account whose required history has aged out.

### Goldsky global indexer

The repository includes a Goldsky/Postgres pipeline intended to preserve complete global event history.

Current limitation:

- the checked-in filter does not yet ingest `set_spender`, `revoke_spender`, or `spender_transfer`.

Until extended, it is not sufficient as the sole durable source for the complete escrow recovery flow.

## Event normalization

Different providers may identify the same on-chain event differently.

The SDK maps source data into a common `ConfidentialEvent` model with:

- ledger;
- transaction hash;
- canonical cursor;
- event type;
- participants; and
- event-specific public and encrypted fields.

Umbra event IDs use a different coordinate convention from Stellar RPC. The parser normalizes the operation and event coordinates before generating the canonical cursor.

## Logical event identity

Cursor equality is not sufficient for cross-source deduplication.

The SDK computes an event-specific logical identity. Representative inputs include:

```text
ledger
transaction hash
event type
account / from / to / spender
public amount where applicable
ephemeral point coordinates
sigma or sigma_a
encrypted balance or allowance checkpoints
```

Two events are treated as duplicates when either:

- their canonical cursors match; or
- their logical payload identities match.

This protects against provider cursor-format defects without relying on plaintext confidential values.

## Replay ordering

State reconstruction is order-sensitive.

Examples:

- `deposit` followed by `merge` differs from `merge` followed by `deposit`;
- an owner checkpoint must be applied before deriving the next outgoing delta; and
- an allowance must be recorded before pairing a later `spender_transfer`.

The SDK performs a stable sort by ledger and preserves source order among events in the same ledger. It does not sort same-ledger events by arbitrary cursor strings.

## State transition rules

### `register`

For the matching account:

```text
registered = true
```

### `deposit`

For the Receiver:

```text
receiving.value += public amount
receiving.blinding remains unchanged
```

A public deposit enters private `Receiving`.

### `merge`

For the matching account:

```text
spendable.value += receiving.value
spendable.blinding += receiving.blinding mod curve scalar field
receiving = zero opening
```

### `withdraw`

For the sender, the event contains an owner-encrypted post-operation spendable checkpoint:

```text
spendable = Open(b_tilde, sigma, viewing_key)
```

### ordinary `transfer`

For the sender:

```text
spendable = Open(b_tilde, sigma, viewing_key)
```

For the Receiver:

```text
amount, transfer_blinding = DecryptRecipient(r_e, v_tilde, sigma)
receiving += { amount, transfer_blinding }
```

A self-transfer applies the sender update before adding the recipient credit.

### `set_spender`

For the allowance owner:

```text
spendable = Open(b_tilde, sigma, viewing_key)
```

The difference between the prior verified spendable opening and this post-operation opening is the newly delegated allowance, assuming complete ordered history.

The client associates the reconstructed allowance with the spender contract address.

### `revoke_spender`

For the allowance owner:

```text
spendable = Open(b_tilde, sigma, viewing_key)
```

Any unmatched allowance associated with that spender is removed from owner-history pairing.

### `spender_transfer`

For the Receiver:

```text
amount, transfer_blinding = DecryptRecipient(r_e, v_tilde, sigma_a)
receiving += { amount, transfer_blinding }
```

For the Payer history view, the event is paired with the previously reconstructed allowance for the same spender.

Because the PoC circuit enforces a zero remaining allowance:

```text
spender_transfer amount == reconstructed allowance
```

This is owner-visible reconstruction, not a Payer sender-disclosure proof.

## Sync algorithm

When Umbra is configured:

```text
load prior local state
fetch complete account history from Umbra
reset to fresh state
normalize and deduplicate Umbra events
replay Umbra events in stable order
record recovered cursor and logical identities
fetch RPC/indexer tail from saved or deployment position
skip events already recovered by cursor or logical identity
apply remaining live events
persist state and current cursor
compare reconstructed commitments with contract commitments
```

Umbra is replayed on every sync rather than only during a one-time migration. This allows recovery from stale or partially corrupted local caches.

When Umbra is unavailable:

- the SDK uses hybrid indexer/RPC history when an indexer is configured;
- legacy caches may run targeted backfill for newly supported event types; and
- RPC-only operation remains bounded by event retention.

## Directly decryptable amounts

### Incoming ordinary transfer

The Receiver derives a shared secret from its viewing key and the event's ephemeral point, then decrypts the transfer amount and blinding.

### Incoming escrow release

The Receiver uses the same recipient principle with the `spender_transfer` event's `sigma_a` field.

These incoming amounts can be recovered independently from the owner's complete balance history, provided the event and confidential key are available.

## Outgoing ordinary transfer

When the wallet generated an ordinary transfer with its deterministic ephemeral derivation, it can recover the sender-side amount channel.

This supports owner display and compatible sender selective disclosure.

If the event was generated with different keys or non-deterministic material, the wallet must return unavailable rather than guess.

## Outgoing escrow release

The Payer owns the allowance but did not generate the delegated transfer.

Therefore:

- the Payer cannot rederive the escrow's transfer ephemeral scalar;
- the Payer cannot claim the ordinary sender disclosure path; and
- the event must be labeled differently from a wallet-originated transfer.

The Payer-visible amount is reconstructed through:

```text
verified spendable before set_spender
- owner-encrypted spendable after set_spender
= allowance

allowance paired by spender contract
+ full-release invariant
= escrow release amount
```

The UI marks third-party proof authority as “spender proof only.”

## Commitment-gated disclosure

Incoming amounts are direct ciphertext decryptions and can be shown when decryption succeeds.

Outgoing balance-delta amounts are conditional. The SDK withholds them unless the full replay opens both current on-chain commitments.

This prevents a partial history from producing a plausible but incorrect amount.

The safety preference is:

```text
unknown > fabricated certainty
```

## Registration read semantics

A failed account read is not equivalent to an unregistered account.

The SDK maps only the explicit Confidential Token not-registered contract error to `null`. It propagates:

- RPC failures;
- CORS failures;
- wrong contract IDs;
- simulation failures; and
- decoding errors.

The UI must not offer registration until the read is known to have succeeded with the explicit negative state.

## Cache versions and migration

The state cache includes a version so newly supported event semantics can trigger targeted recovery.

Historical examples:

- earlier clients ignored `spender_transfer`;
- later clients added Umbra full replay; and
- current clients include owner checkpoint and logical deduplication semantics.

When Umbra is configured, the safest migration is a complete account rebuild from the deployment ledger.

## Failure modes

### Missing history

Result:

- an opening may be unrecoverable; or
- commitment verification fails.

Action:

- restore access to a compatible durable history source;
- do not submit proof-carrying state changes.

### Duplicated history

Result:

- reconstructed values may be too high; or
- commitment verification fails.

Action:

- inspect canonical cursor and logical identity normalization.

### Reordered history

Result:

- merges, checkpoints, and allowances may be applied incorrectly.

Action:

- preserve stable protocol order within each ledger.

### Wrong deployment

Result:

- confidential keys differ;
- events do not correspond to the account state; and
- commitments fail.

Action:

- verify token contract, network passphrase, deployment ledger, and active app configuration.

### Wrong Freighter account

Result:

- a different confidential key and address context are used.

Action:

- confirm the active role and public key before signing the deployment-bound message.

### Stale SDK bundle

Result:

- new event types or recovery rules are absent at runtime.

Action:

- rebuild SDK and generated application assets.

## Security properties

The recovery model provides:

- no plaintext amount dependency on history providers;
- verification of final openings against the chain;
- conservative handling of partial history;
- separation of business ownership from cryptographic proof authority;
- cross-source duplicate resistance; and
- deterministic recovery from deployment-bound keys when complete history is available.

It does not provide:

- anonymity of addresses or timing;
- guaranteed availability of every external history service;
- production-grade browser key custody;
- escrow discovery across devices;
- protection from a compromised user device; or
- independent cryptographic audit assurance.

## Tests

The recovery model is covered by focused checks:

- `release-recovery.mjs`;
- `umbra-history.mjs`;
- `umbra-state-recovery.mjs`;
- `dedup.mjs`;
- `registration-read.mjs`;
- `originator-sender-channel.mjs`;
- `auditor.mjs`; and
- `full-release-circuit.mjs`.

## Required next work

1. Add spender events to the global indexer and parity tests.
2. Add factory escrow discovery and import.
3. Encrypt cached confidential material and design explicit backup/recovery.
4. Define key rotation and Auditor rotation procedures.
5. Add adversarial tests for provider omission, mutation, and reordering.
6. Audit the complete event-to-opening reconstruction path as part of the cryptographic protocol.
