#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub struct CreditProfile {
    pub score: u32,        // 300–850
    pub loans_repaid: u32,
    pub loans_defaulted: u32,
    pub total_borrowed: i128,
    pub total_repaid: i128,
}

#[contracttype]
pub enum DataKey {
    Profile(Address),
    Admin,
}

const MIN_SCORE: u32 = 300;
const MAX_SCORE: u32 = 850;
const DEFAULT_SCORE: u32 = 500;
const REPAY_REWARD: u32 = 20;
const DEFAULT_PENALTY: u32 = 80;

#[contract]
pub struct CreditScoreContract;

#[contractimpl]
impl CreditScoreContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn get_score(env: Env, borrower: Address) -> u32 {
        env.storage()
            .persistent()
            .get::<_, CreditProfile>(&DataKey::Profile(borrower))
            .map(|p| p.score)
            .unwrap_or(DEFAULT_SCORE)
    }

    pub fn get_profile(env: Env, borrower: Address) -> CreditProfile {
        env.storage()
            .persistent()
            .get(&DataKey::Profile(borrower.clone()))
            .unwrap_or(CreditProfile {
                score: DEFAULT_SCORE,
                loans_repaid: 0,
                loans_defaulted: 0,
                total_borrowed: 0,
                total_repaid: 0,
            })
    }

    pub fn reward_repayment(env: Env, borrower: Address, amount: i128) {
        Self::require_admin(&env);
        let mut profile = Self::get_profile(env.clone(), borrower.clone());
        profile.loans_repaid += 1;
        profile.total_repaid += amount;
        profile.score = (profile.score + REPAY_REWARD).min(MAX_SCORE);
        env.storage()
            .persistent()
            .set(&DataKey::Profile(borrower.clone()), &profile);
        env.events().publish(
            (Symbol::new(&env, "repayment_rewarded"), borrower),
            profile.score,
        );
    }

    pub fn penalize_default(env: Env, borrower: Address, amount: i128) {
        Self::require_admin(&env);
        let mut profile = Self::get_profile(env.clone(), borrower.clone());
        profile.loans_defaulted += 1;
        profile.total_borrowed += amount;
        profile.score = profile.score.saturating_sub(DEFAULT_PENALTY).max(MIN_SCORE);
        env.storage()
            .persistent()
            .set(&DataKey::Profile(borrower.clone()), &profile);
        env.events().publish(
            (Symbol::new(&env, "default_penalized"), borrower),
            profile.score,
        );
    }

    pub fn record_borrow(env: Env, borrower: Address, amount: i128) {
        Self::require_admin(&env);
        let mut profile = Self::get_profile(env.clone(), borrower.clone());
        profile.total_borrowed += amount;
        env.storage()
            .persistent()
            .set(&DataKey::Profile(borrower), &profile);
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

    #[test]
    fn test_default_score() {
        let env = Env::default();
        let contract_id = env.register(CreditScoreContract, ());
        let client = CreditScoreContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let borrower = Address::generate(&env);

        client.initialize(&admin);
        assert_eq!(client.get_score(&borrower), 500);
    }

    #[test]
    fn test_reward_repayment() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(CreditScoreContract, ());
        let client = CreditScoreContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let borrower = Address::generate(&env);

        client.initialize(&admin);
        client.reward_repayment(&borrower, &7_000_000);
        assert_eq!(client.get_score(&borrower), 520);
    }

    #[test]
    fn test_penalize_default() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(CreditScoreContract, ());
        let client = CreditScoreContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let borrower = Address::generate(&env);

        client.initialize(&admin);
        client.penalize_default(&borrower, &7_000_000);
        assert_eq!(client.get_score(&borrower), 420);
    }

    #[test]
    fn test_score_capped_at_max() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(CreditScoreContract, ());
        let client = CreditScoreContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let borrower = Address::generate(&env);

        client.initialize(&admin);
        for _ in 0..20 {
            client.reward_repayment(&borrower, &1_000_000);
        }
        assert_eq!(client.get_score(&borrower), MAX_SCORE);
    }
}
