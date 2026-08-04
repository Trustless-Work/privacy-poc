# One-milestone escrow contract specification

Last updated: August 4, 2026.

## Product behavior

The PoC models the complete escrow as one milestone. The Payer funds it by creating one confidential allowance through the escrow contract. A single configured Approver executes `approve_and_release`, which transfers the entire allowance to the configured Receiver in the same Soroban transaction.

There is no separate approval step, release signer, partial release, dispute, fee, or contract-managed cancellation in v0.

Each escrow is an independent contract deployed from the shared factory. The factory is a deployment mechanism only; it does not participate in the escrow lifecycle after returning the new contract address.

## Public state

```rust
pub enum EscrowStatus {
    Initialized,
    Funded,
    Released,
}

pub struct Escrow {
    pub payer: Address,
    pub receiver: Address,
    pub approver: Address,
    pub confidential_token: Address,
    pub status: EscrowStatus,
}
```

The amount is never stored or emitted by the escrow contract. The live confidential allowance is held by the Confidential Token contract under the `(payer, escrow_contract)` delegation entry.

## Factory deployment

The shared factory exposes `deploy_escrow(salt)` and deploys a fresh uninitialized instance from the installed escrow WASM hash.

The browser then performs initialization as a separate Freighter-signed transaction because the escrow registration proof is bound to the newly known contract address.

Current factory limitations:

- no `escrow_deployed` event;
- no global instance registry;
- no ownership or lifecycle management after deployment; and
- escrow discovery is therefore browser-local unless the address is imported manually.

## Entry points

### `initialize`

```rust
fn initialize(
    env: Env,
    payer: Address,
    receiver: Address,
    approver: Address,
    confidential_token: Address,
    spender_auditor_id: u32,
    spender_registration_data: Bytes,
);
```

Requirements:

- callable once;
- Approver authorizes initialization;
- Payer, Receiver, and Approver are distinct for the PoC;
- Payer and Receiver are registered Confidential Token accounts;
- escrow invokes `register(current_contract, spender_auditor_id, spender_registration_data)` on the Confidential Token contract; and
- contract records `Initialized`.

The escrow's confidential key is generated off-chain after deployment because registration is bound to the escrow contract address. The Approver/prover holds this PoC key so it can decrypt the delegated viewing key and build the eventual release proof.

Soroban spending authority remains with the escrow contract address. Possession of the proving key alone cannot call `confidential_transfer_from` successfully.

### `fund`

```rust
fn fund(
    env: Env,
    live_until_ledger: u32,
    set_spender_data: Bytes,
);
```

Requirements:

- current state is `Initialized`;
- Payer authorizes the complete invocation;
- expiry is in the future;
- escrow invokes `set_spender(payer, current_contract, live_until_ledger, set_spender_data)`;
- Confidential Token verification succeeds and creates an active delegation; and
- escrow records `Funded`.

This function never receives or learns a plaintext amount. The amount is supplied only as a private witness when the Payer SDK builds `set_spender_data`.

The Confidential Token contract emits `set_spender`, including an owner-encrypted post-operation spendable checkpoint. That event is part of the client recovery model but is not an escrow contract guarantee.

### `approve_and_release`

```rust
fn approve_and_release(env: Env, release_data: Bytes);
```

Requirements:

- current state is `Funded`;
- configured Approver authorizes the call;
- delegation remains active;
- escrow authorizes its own nested call as the spender;
- escrow invokes:

```rust
confidential_transfer_from(
    spender = current_contract,
    from = payer,
    to = receiver,
    data = release_data,
)
```

- `release_data` is verified with the PoC deployment's modified `SpenderTransfer` circuit;
- the circuit enforces that the post-transfer allowance value is zero; and
- only after the nested transfer succeeds does status become `Released`.

Soroban transaction atomicity ensures that a failed nested transfer rolls back the complete call, including the status update.

## Escrow events

```rust
EscrowInitialized { payer, receiver, approver }
EscrowFunded { payer }
EscrowReleased { payer, receiver, approver }
```

No escrow event contains an amount or amount commitment.

The Confidential Token contract emits the encrypted value-recovery events:

- `set_spender` when the allowance is created;
- `revoke_spender` if remaining allowance is reclaimed; and
- `spender_transfer` when the escrow releases value.

These token events are required for wallet history and private-state recovery but do not alter the escrow state machine.

## Minimal circuit change

The dedicated PoC deployment starts from the upstream `SpenderTransfer` circuit and retains its checks for:

- spender key knowledge;
- allowance opening and sufficiency;
- recipient encryption;
- conservation between allowance deduction and receiver transfer;
- Auditor ciphertexts;
- new allowance commitment; and
- current-commitment replay protection.

It adds one private-value constraint:

```text
new_allowance_value == 0
```

This makes the private transfer equal the complete old allowance without making either value public. General partial delegated spending is intentionally unsupported in this deployment.

## Proof-generation flow

1. Payer SDK builds `set_spender_data` with the private escrow amount.
2. Payer calls `fund`; the escrow creates the delegation atomically.
3. Approver/prover reads the public delegation entry.
4. Approver/prover decrypts the escrowed delegation viewing key using the PoC escrow-spender key.
5. SDK recovers the current allowance opening.
6. SDK builds the modified delegated-transfer proof with transfer amount equal to the complete allowance and remaining allowance equal to zero.
7. Approver submits the proof to `approve_and_release`.
8. Escrow supplies the fixed Payer and Receiver addresses and invokes the token contract.
9. The token emits `spender_transfer`; Receiver and Auditor clients recover their authorized views from its encrypted channels.

## Contract guarantees versus client guarantees

### Contract guarantees

- fixed Payer, Receiver, Approver, and token after initialization;
- exactly one successful transition from `Funded` to `Released`;
- configured Approver authorization;
- fixed Receiver for the nested delegated transfer;
- proof-bound current allowance state;
- complete allowance exhaustion; and
- atomic rollback if the nested transfer fails.

### Client and recovery guarantees

Implemented outside the escrow contract:

- decoding `set_spender`, `revoke_spender`, and `spender_transfer`;
- durable history retrieval;
- event normalization and deduplication;
- Receiver private-balance reconstruction;
- Payer owner-visible allowance and release history;
- selective disclosure labeling; and
- verification that reconstructed openings match live on-chain commitments.

The escrow may be correctly `Released` even when a stale client has not yet reconstructed the Receiver balance. Client visibility is not evidence of contract success or failure.

## Expected failure cases

- caller is not the Approver;
- escrow is not `Funded`;
- delegation is absent, expired, or revoked;
- Receiver in proof does not match configured Receiver;
- proof attempts a partial release;
- proof references an old allowance commitment;
- a second approval is attempted after release; or
- Confidential Token verification fails.

## Explicit v0 limitations

- The underlying protocol allows the Payer to revoke a delegation before release. If this occurs, `approve_and_release` fails and the escrow remains `Funded` but unreleasable until product semantics define the next action.
- There is no cancellation or dispute state in the escrow.
- There is no partial release or multi-milestone support.
- There is no fee extraction.
- The factory emits no discovery event.
- The PoC key and Auditor operations are not production custody designs.
