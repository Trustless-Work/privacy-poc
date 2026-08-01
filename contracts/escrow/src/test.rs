extern crate std;

use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Bytes, Env};

#[contracttype]
enum MockKey {
    Registered,
    Delegation,
    Transfer,
    FailTransfer,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct MockDelegation {
    owner: Address,
    spender: Address,
    live_until_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct MockTransfer {
    spender: Address,
    owner: Address,
    receiver: Address,
}

#[contract]
struct MockConfidentialToken;

#[contractimpl]
impl MockConfidentialToken {
    pub fn register(e: &Env, account: Address, _auditor_id: u32, _data: Bytes) {
        account.require_auth();
        e.storage().instance().set(&MockKey::Registered, &account);
    }

    pub fn set_spender(
        e: &Env,
        account: Address,
        spender: Address,
        live_until_ledger: u32,
        _data: Bytes,
    ) {
        account.require_auth();
        e.storage().instance().set(
            &MockKey::Delegation,
            &MockDelegation {
                owner: account,
                spender,
                live_until_ledger,
            },
        );
    }

    pub fn confidential_transfer_from(
        e: &Env,
        spender: Address,
        from: Address,
        to: Address,
        _data: Bytes,
    ) {
        spender.require_auth();
        if e.storage()
            .instance()
            .get::<_, bool>(&MockKey::FailTransfer)
            .unwrap_or(false)
        {
            panic!("mock confidential transfer failed");
        }
        e.storage().instance().set(
            &MockKey::Transfer,
            &MockTransfer {
                spender,
                owner: from,
                receiver: to,
            },
        );
    }

    pub fn registered(e: &Env) -> Address {
        e.storage().instance().get(&MockKey::Registered).unwrap()
    }

    pub fn delegation(e: &Env) -> MockDelegation {
        e.storage().instance().get(&MockKey::Delegation).unwrap()
    }

    pub fn transfer(e: &Env) -> MockTransfer {
        e.storage().instance().get(&MockKey::Transfer).unwrap()
    }
}

struct Fixture {
    env: Env,
    escrow_address: Address,
    token_address: Address,
    payer: Address,
    receiver: Address,
    approver: Address,
}

fn fixture() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let token_address = env.register(MockConfidentialToken, ());
    let escrow_address = env.register(ConfidentialEscrowContract, ());
    let escrow = ConfidentialEscrowContractClient::new(&env, &escrow_address);
    let payer = Address::generate(&env);
    let receiver = Address::generate(&env);
    let approver = Address::generate(&env);

    escrow.initialize(
        &payer,
        &receiver,
        &approver,
        &token_address,
        &0,
        &Bytes::new(&env),
    );

    Fixture {
        env,
        escrow_address,
        token_address,
        payer,
        receiver,
        approver,
    }
}

#[test]
fn initialize_registers_the_escrow_as_spender_account() {
    let f = fixture();
    let token = MockConfidentialTokenClient::new(&f.env, &f.token_address);
    let escrow = ConfidentialEscrowContractClient::new(&f.env, &f.escrow_address);
    assert_eq!(token.registered(), f.escrow_address);
    assert_eq!(escrow.get_escrow().status, EscrowStatus::Initialized);
    assert_eq!(escrow.get_escrow().approver, f.approver);
}

#[test]
fn fund_and_approve_release_to_the_fixed_receiver() {
    let f = fixture();
    let token = MockConfidentialTokenClient::new(&f.env, &f.token_address);
    let escrow = ConfidentialEscrowContractClient::new(&f.env, &f.escrow_address);
    let expiry = f.env.ledger().sequence() + 100;

    escrow.fund(&expiry, &Bytes::new(&f.env));
    let fund_auths = f.env.auths();
    assert_eq!(fund_auths.len(), 1);
    assert_eq!(fund_auths[0].0, f.payer);
    let delegation = token.delegation();
    assert_eq!(delegation.owner, f.payer);
    assert_eq!(delegation.spender, f.escrow_address);
    assert_eq!(escrow.get_escrow().status, EscrowStatus::Funded);

    escrow.approve_and_release(&Bytes::new(&f.env));
    let release_auths = f.env.auths();
    assert_eq!(release_auths.len(), 1);
    assert_eq!(release_auths[0].0, f.approver);
    let transfer = token.transfer();
    assert_eq!(transfer.spender, f.escrow_address);
    assert_eq!(transfer.owner, f.payer);
    assert_eq!(transfer.receiver, f.receiver);
    assert_eq!(escrow.get_escrow().status, EscrowStatus::Released);
}

#[test]
fn a_second_release_is_rejected() {
    let f = fixture();
    let escrow = ConfidentialEscrowContractClient::new(&f.env, &f.escrow_address);
    escrow
        .fund(&(f.env.ledger().sequence() + 100), &Bytes::new(&f.env));
    escrow.approve_and_release(&Bytes::new(&f.env));

    assert!(escrow
        .try_approve_and_release(&Bytes::new(&f.env))
        .is_err());
}

#[test]
fn expired_funding_is_rejected() {
    let f = fixture();
    let escrow = ConfidentialEscrowContractClient::new(&f.env, &f.escrow_address);
    assert!(escrow
        .try_fund(&f.env.ledger().sequence(), &Bytes::new(&f.env))
        .is_err());
    assert_eq!(escrow.get_escrow().status, EscrowStatus::Initialized);
}
