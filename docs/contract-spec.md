# One-Milestone Escrow Contract Specification

## Product behavior

The PoC models the complete escrow as one milestone. The payer funds it by creating one confidential allowance through the escrow contract. A single configured approver executes `approve_and_release`, which transfers the entire allowance to the configured receiver in the same transaction.

There is no separate approve step, release signer, partial release, dispute, fee, or contract-managed cancellation in v0.

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
- approver authorizes initialization;
- payer, receiver, and approver are distinct for the PoC;
- payer and receiver are registered confidential-token accounts;
- escrow invokes `register(current_contract, spender_auditor_id, spender_registration_data)` on the Confidential Token contract;
- contract records `Initialized`.

The escrow's confidential key is generated off-chain after deployment because registration is bound to the escrow contract address. The approver/prover holds this PoC key so it can decrypt the delegated viewing key and build the eventual release proof. Soroban spending authority remains with the escrow contract address, so possession of the proving key alone cannot call `confidential_transfer_from` successfully.

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
- payer authorizes the complete invocation;
- expiry is in the future;
- escrow invokes `set_spender(payer, current_contract, live_until_ledger, set_spender_data)`;
- confidential-token verification succeeds and creates an active delegation;
- escrow records `Funded`.

This function never receives or learns a plaintext amount. The amount is supplied only as a private witness when the payer's SDK builds `set_spender_data`.

### `approve_and_release`

```rust
fn approve_and_release(env: Env, release_data: Bytes);
```

Requirements:

- current state is `Funded`;
- configured approver authorizes the call;
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
- the circuit enforces that the post-transfer allowance value is zero;
- only after the nested transfer succeeds does status become `Released`.

Soroban transaction atomicity ensures that a failed nested transfer rolls back the complete call, including the status update.

## Events

```rust
EscrowInitialized { payer, receiver, approver }
EscrowFunded { payer }
EscrowReleased { payer, receiver, approver }
```

No event contains an amount or amount commitment. The Confidential Token contract emits the encrypted transfer data required by the receiver and auditor.

## Minimal circuit change

In the dedicated PoC deployment, start from the upstream `SpenderTransfer` circuit and retain its existing checks for:

- spender key knowledge;
- allowance opening and sufficiency;
- recipient encryption;
- conservation between allowance deduction and receiver transfer;
- auditor ciphertexts;
- new allowance commitment;
- current-commitment replay protection.

Add one private-value constraint:

```text
new_allowance_value == 0
```

This makes the private transfer equal the complete old allowance without making either value public. The PoC's `confidential_transfer_from` therefore always exhausts a delegation; general partial delegated spending is intentionally unsupported in this deployment.

## Proof-generation flow

1. Payer's SDK builds `set_spender_data` with the private escrow amount.
2. Payer calls `fund`; the escrow contract creates the delegation atomically.
3. Approver/prover reads the public delegation entry.
4. Approver/prover decrypts the escrowed delegation viewing key using the PoC escrow-spender key.
5. SDK recovers the current allowance opening.
6. SDK builds the modified spender-transfer proof with transfer amount equal to the full allowance and remaining allowance equal to zero.
7. Approver submits the proof to `approve_and_release`.
8. Escrow contract supplies the fixed payer and receiver addresses and invokes the token contract.

## Expected failure cases

- caller is not the approver;
- escrow is not `Funded`;
- delegation is absent, expired, or revoked;
- receiver in proof does not match configured receiver;
- proof attempts a partial release;
- proof references an old allowance commitment;
- a second approval is attempted after release;
- confidential-token verification fails.

## Explicit v0 limitation

The underlying protocol allows the payer to revoke a delegation before release. If that occurs, `approve_and_release` fails and the escrow remains unreleased. Preventing unilateral revocation would require a deeper protocol change and is not part of this first privacy PoC.
