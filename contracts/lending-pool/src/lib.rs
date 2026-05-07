#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

/// Lending pool where lenders deposit USDC and borrowers draw from.
/// Interest model: fixed 10% APR simplified to per-loan basis points.

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    TotalDeposits,
    TotalBorrowed,
    Deposit(Address),
}

#[contract]
pub struct LendingPoolContract;

#[contractimpl]
impl LendingPoolContract {
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TotalDeposits, &0i128);
        env.storage().instance().set(&DataKey::TotalBorrowed, &0i128);
    }

    /// Lender deposits USDC into the pool.
    pub fn deposit(env: Env, lender: Address, amount: i128) {
        lender.require_auth();
        assert!(amount > 0, "amount must be positive");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(
            &lender,
            &env.current_contract_address(),
            &amount,
        );

        let prev: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Deposit(lender.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Deposit(lender.clone()), &(prev + amount));

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap();
        env.storage()
            .instance()
            .set(&DataKey::TotalDeposits, &(total + amount));

        env.events()
            .publish((Symbol::new(&env, "deposited"), lender), amount);
    }

    /// Lender withdraws their share.
    pub fn withdraw(env: Env, lender: Address, amount: i128) {
        lender.require_auth();
        let deposited: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Deposit(lender.clone()))
            .unwrap_or(0);
        assert!(deposited >= amount, "insufficient balance");

        let available = Self::available_liquidity(env.clone());
        assert!(available >= amount, "insufficient pool liquidity");

        env.storage()
            .persistent()
            .set(&DataKey::Deposit(lender.clone()), &(deposited - amount));

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap();
        env.storage()
            .instance()
            .set(&DataKey::TotalDeposits, &(total - amount));

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(
            &env.current_contract_address(),
            &lender,
            &amount,
        );

        env.events()
            .publish((Symbol::new(&env, "withdrawn"), lender), amount);
    }

    /// Called by LoanManager to draw funds for a loan.
    pub fn borrow(env: Env, to: Address, amount: i128) {
        Self::require_admin(&env);
        let available = Self::available_liquidity(env.clone());
        assert!(available >= amount, "insufficient liquidity");

        let total_borrowed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBorrowed)
            .unwrap();
        env.storage()
            .instance()
            .set(&DataKey::TotalBorrowed, &(total_borrowed + amount));

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );

        env.events()
            .publish((Symbol::new(&env, "borrowed"), to), amount);
    }

    /// Called when a loan is repaid — returns funds to pool.
    pub fn receive_repayment(env: Env, from: Address, amount: i128) {
        Self::require_admin(&env);
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        let total_borrowed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBorrowed)
            .unwrap();
        let new_borrowed = (total_borrowed - amount).max(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalBorrowed, &new_borrowed);
    }

    pub fn get_deposit(env: Env, lender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Deposit(lender))
            .unwrap_or(0)
    }

    pub fn total_deposits(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0)
    }

    pub fn total_borrowed(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalBorrowed)
            .unwrap_or(0)
    }

    pub fn available_liquidity(env: Env) -> i128 {
        let deposits = Self::total_deposits(env.clone());
        let borrowed = Self::total_borrowed(env);
        (deposits - borrowed).max(0)
    }

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::token::StellarAssetClient;

    fn setup() -> (Env, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_addr = token_id.address();

        let contract_id = env.register(LendingPoolContract, ());
        LendingPoolContractClient::new(&env, &contract_id).initialize(&admin, &token_addr);
        (env, contract_id, admin, token_addr)
    }

    #[test]
    fn test_deposit_and_withdraw() {
        let (env, contract_id, _admin, token_addr) = setup();
        let client = LendingPoolContractClient::new(&env, &contract_id);
        let sac = StellarAssetClient::new(&env, &token_addr);
        let lender = Address::generate(&env);

        sac.mint(&lender, &100_000_000);
        client.deposit(&lender, &50_000_000);
        assert_eq!(client.get_deposit(&lender), 50_000_000);
        assert_eq!(client.total_deposits(), 50_000_000);

        client.withdraw(&lender, &20_000_000);
        assert_eq!(client.get_deposit(&lender), 30_000_000);
    }

    #[test]
    fn test_borrow_reduces_liquidity() {
        let (env, contract_id, _admin, token_addr) = setup();
        let client = LendingPoolContractClient::new(&env, &contract_id);
        let sac = StellarAssetClient::new(&env, &token_addr);
        let lender = Address::generate(&env);
        let borrower = Address::generate(&env);

        sac.mint(&lender, &100_000_000);
        client.deposit(&lender, &100_000_000);
        client.borrow(&borrower, &7_000_000);

        assert_eq!(client.available_liquidity(), 93_000_000);
        assert_eq!(client.total_borrowed(), 7_000_000);
    }

    #[test]
    #[should_panic(expected = "insufficient liquidity")]
    fn test_borrow_exceeds_liquidity() {
        let (env, contract_id, _admin, token_addr) = setup();
        let client = LendingPoolContractClient::new(&env, &contract_id);
        let sac = StellarAssetClient::new(&env, &token_addr);
        let lender = Address::generate(&env);

        sac.mint(&lender, &10_000_000);
        client.deposit(&lender, &10_000_000);
        client.borrow(&lender, &20_000_000); // should panic
    }
}
