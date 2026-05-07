#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum LoanStatus {
    Active,
    Repaid,
    Defaulted,
}

#[contracttype]
#[derive(Clone)]
pub struct Loan {
    pub id: u64,
    pub borrower: Address,
    pub amount: i128,        // in stroops (7 decimals)
    pub interest_bps: u32,   // basis points, e.g. 1000 = 10%
    pub due_ledger: u32,
    pub repaid_amount: i128,
    pub status: LoanStatus,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    LoanCounter,
    Loan(u64),
    BorrowerLoans(Address),
}

#[contract]
pub struct LoanManagerContract;

#[contractimpl]
impl LoanManagerContract {
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::LoanCounter, &0u64);
    }

    pub fn create_loan(
        env: Env,
        borrower: Address,
        amount: i128,
        interest_bps: u32,
        duration_ledgers: u32,
    ) -> u64 {
        Self::require_admin(&env);
        assert!(amount > 0, "amount must be positive");
        assert!(interest_bps <= 5000, "interest too high");

        let id: u64 = env.storage().instance().get(&DataKey::LoanCounter).unwrap();
        let loan = Loan {
            id,
            borrower: borrower.clone(),
            amount,
            interest_bps,
            due_ledger: env.ledger().sequence() + duration_ledgers,
            repaid_amount: 0,
            status: LoanStatus::Active,
        };
        env.storage().persistent().set(&DataKey::Loan(id), &loan);
        env.storage()
            .instance()
            .set(&DataKey::LoanCounter, &(id + 1));

        // Transfer tokens to borrower
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(
            &env.current_contract_address(),
            &borrower,
            &amount,
        );

        env.events()
            .publish((Symbol::new(&env, "loan_created"), borrower), (id, amount));
        id
    }

    pub fn repay(env: Env, loan_id: u64, payer: Address, amount: i128) {
        payer.require_auth();
        let mut loan: Loan = env
            .storage()
            .persistent()
            .get(&DataKey::Loan(loan_id))
            .expect("loan not found");
        assert!(loan.status == LoanStatus::Active, "loan not active");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(
            &payer,
            &env.current_contract_address(),
            &amount,
        );

        loan.repaid_amount += amount;
        let total_due = Self::total_due(&loan);
        if loan.repaid_amount >= total_due {
            loan.status = LoanStatus::Repaid;
            env.events().publish(
                (Symbol::new(&env, "loan_repaid"), loan.borrower.clone()),
                loan_id,
            );
        }
        env.storage().persistent().set(&DataKey::Loan(loan_id), &loan);
    }

    pub fn default_loan(env: Env, loan_id: u64) {
        Self::require_admin(&env);
        let mut loan: Loan = env
            .storage()
            .persistent()
            .get(&DataKey::Loan(loan_id))
            .expect("loan not found");
        assert!(loan.status == LoanStatus::Active, "loan not active");
        assert!(
            env.ledger().sequence() > loan.due_ledger,
            "loan not yet overdue"
        );
        loan.status = LoanStatus::Defaulted;
        env.storage().persistent().set(&DataKey::Loan(loan_id), &loan);
        env.events().publish(
            (Symbol::new(&env, "loan_defaulted"), loan.borrower.clone()),
            loan_id,
        );
    }

    pub fn get_loan(env: Env, loan_id: u64) -> Loan {
        env.storage()
            .persistent()
            .get(&DataKey::Loan(loan_id))
            .expect("loan not found")
    }

    fn total_due(loan: &Loan) -> i128 {
        loan.amount + (loan.amount * loan.interest_bps as i128 / 10_000)
    }

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{token::StellarAssetClient, Env};

    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let borrower = Address::generate(&env);

        // Deploy a mock token
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_addr = token_id.address();
        let token_sac = StellarAssetClient::new(&env, &token_addr);

        let contract_id = env.register(LoanManagerContract, ());
        // Fund the contract
        token_sac.mint(&contract_id, &1_000_000_000);

        LoanManagerContractClient::new(&env, &contract_id)
            .initialize(&admin, &token_addr);

        (env, contract_id, admin, borrower, token_addr)
    }

    #[test]
    fn test_create_and_repay_loan() {
        let (env, contract_id, _admin, borrower, token_addr) = setup();
        let client = LoanManagerContractClient::new(&env, &contract_id);
        let token = soroban_sdk::token::Client::new(&env, &token_addr);
        let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);

        // Fund borrower for repayment
        sac.mint(&borrower, &100_000_000);

        let loan_id = client.create_loan(&borrower, &7_000_000, &1000, &1000);
        let loan = client.get_loan(&loan_id);
        assert_eq!(loan.status, LoanStatus::Active);
        assert_eq!(token.balance(&borrower), 107_000_000);

        // Repay full amount (7M + 10% = 7.7M)
        client.repay(&loan_id, &borrower, &7_700_000);
        let loan = client.get_loan(&loan_id);
        assert_eq!(loan.status, LoanStatus::Repaid);
    }

    #[test]
    fn test_default_loan() {
        let (env, contract_id, _admin, borrower, _token_addr) = setup();
        let client = LoanManagerContractClient::new(&env, &contract_id);

        let loan_id = client.create_loan(&borrower, &5_000_000, &500, &100);
        // Advance ledger past due date
        env.ledger().with_mut(|l| l.sequence_number += 200);
        client.default_loan(&loan_id);
        let loan = client.get_loan(&loan_id);
        assert_eq!(loan.status, LoanStatus::Defaulted);
    }
}
