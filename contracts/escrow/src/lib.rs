//! One-milestone confidential escrow proof of concept.
//!
//! One payer delegates one private allowance to this contract. One configured
//! approver can release the complete allowance to one configured receiver.
//! The amount is never accepted, stored, or emitted by this contract.
//!
//! # Warning
//!
//! This is testnet-only research code. The confidential-token implementation,
//! verifier, circuits, and this integration have not been audited.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Bytes, Env,
};
use stellar_tokens::confidential::ConfidentialTokenClient;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Initialized,
    Funded,
    Released,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub payer: Address,
    pub receiver: Address,
    pub approver: Address,
    pub confidential_token: Address,
    pub status: EscrowStatus,
}

#[contracttype]
enum StorageKey {
    Escrow,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidParties = 3,
    InvalidStatus = 4,
    InvalidExpiry = 5,
}

#[contractevent(topics = ["init"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowInitialized {
    #[topic]
    pub payer: Address,
    #[topic]
    pub receiver: Address,
    #[topic]
    pub approver: Address,
}

#[contractevent(topics = ["funded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowFunded {
    #[topic]
    pub payer: Address,
}

#[contractevent(topics = ["released"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowReleased {
    #[topic]
    pub payer: Address,
    #[topic]
    pub receiver: Address,
    #[topic]
    pub approver: Address,
}

#[contract]
pub struct ConfidentialEscrowContract;

#[contractimpl]
impl ConfidentialEscrowContract {
    /// Initializes the fixed parties and registers this contract as a
    /// confidential-token account. The registration proof must be generated
    /// for this deployed escrow address.
    pub fn initialize(
        e: &Env,
        payer: Address,
        receiver: Address,
        approver: Address,
        confidential_token: Address,
        spender_auditor_id: u32,
        spender_registration_data: Bytes,
    ) -> Result<(), EscrowError> {
        if e.storage().instance().has(&StorageKey::Escrow) {
            return Err(EscrowError::AlreadyInitialized);
        }
        if payer == receiver || payer == approver || receiver == approver {
            return Err(EscrowError::InvalidParties);
        }

        approver.require_auth();

        let contract_address = e.current_contract_address();
        ConfidentialTokenClient::new(e, &confidential_token).register(
            &contract_address,
            &spender_auditor_id,
            &spender_registration_data,
        );

        let escrow = Escrow {
            payer: payer.clone(),
            receiver: receiver.clone(),
            approver: approver.clone(),
            confidential_token,
            status: EscrowStatus::Initialized,
        };
        e.storage().instance().set(&StorageKey::Escrow, &escrow);
        EscrowInitialized {
            payer,
            receiver,
            approver,
        }
        .publish(e);
        Ok(())
    }

    /// Moves a private amount from the payer's spendable balance into a
    /// delegation owned by this contract. The amount exists only inside the
    /// proof-carrying `set_spender_data` envelope.
    pub fn fund(
        e: &Env,
        live_until_ledger: u32,
        set_spender_data: Bytes,
    ) -> Result<(), EscrowError> {
        let mut escrow = read_escrow(e)?;
        if escrow.status != EscrowStatus::Initialized {
            return Err(EscrowError::InvalidStatus);
        }
        if live_until_ledger <= e.ledger().sequence() {
            return Err(EscrowError::InvalidExpiry);
        }

        escrow.payer.require_auth();

        ConfidentialTokenClient::new(e, &escrow.confidential_token).set_spender(
            &escrow.payer,
            &e.current_contract_address(),
            &live_until_ledger,
            &set_spender_data,
        );

        escrow.status = EscrowStatus::Funded;
        e.storage().instance().set(&StorageKey::Escrow, &escrow);
        EscrowFunded {
            payer: escrow.payer,
        }
        .publish(e);
        Ok(())
    }

    /// Approves the milestone and atomically releases the delegated allowance.
    /// The PoC-specific spender-transfer circuit must constrain the remaining
    /// allowance to zero; this contract never learns the released amount.
    pub fn approve_and_release(e: &Env, release_data: Bytes) -> Result<(), EscrowError> {
        let mut escrow = read_escrow(e)?;
        if escrow.status != EscrowStatus::Funded {
            return Err(EscrowError::InvalidStatus);
        }

        escrow.approver.require_auth();

        ConfidentialTokenClient::new(e, &escrow.confidential_token)
            .confidential_transfer_from(
                &e.current_contract_address(),
                &escrow.payer,
                &escrow.receiver,
                &release_data,
            );

        // Cross-contract failures abort the invocation before this write. The
        // state can therefore never say Released unless the transfer succeeded.
        escrow.status = EscrowStatus::Released;
        e.storage().instance().set(&StorageKey::Escrow, &escrow);
        EscrowReleased {
            payer: escrow.payer,
            receiver: escrow.receiver,
            approver: escrow.approver,
        }
        .publish(e);
        Ok(())
    }

    pub fn get_escrow(e: &Env) -> Result<Escrow, EscrowError> {
        read_escrow(e)
    }
}

fn read_escrow(e: &Env) -> Result<Escrow, EscrowError> {
    e.storage()
        .instance()
        .get(&StorageKey::Escrow)
        .ok_or(EscrowError::NotInitialized)
}

#[cfg(test)]
mod test;
