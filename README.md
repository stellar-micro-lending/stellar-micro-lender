# Stellar Micro-Lender

A decentralized micro-credit protocol on the Stellar network enabling instant $5–$50 loans for unbanked users via mobile wallets, USDC stablecoins, and Soroban smart contracts.

Built for emerging markets in Africa, Southeast Asia, and Latin America — where Stellar's near-zero fees and 3–5 second finality make micro-repayments economically viable.

---

## Why Stellar

| Problem | Stellar's Answer |
|---|---|
| Gas fees exceed loan value on other chains | Fees are fractions of a cent |
| Slow settlement breaks mobile UX | 3–5 second finality |
| Local currency inflation risk | USDC stablecoin native support |
| No fiat on/off ramp | Anchor network (MoneyGram, M-Pesa, MTN MoMo) |
| No credit history for unbanked users | On-chain reputation via CreditScore contract |

---

## Architecture

```
Mobile App / Web Dashboard
        │
        ▼
  NestJS API Gateway
        │
   ┌────┴────┐
   │         │
KYC/Auth  Credit Engine
   │         │
   └────┬────┘
        │
  Stellar Anchors  ←→  Mobile Money (M-Pesa, MTN MoMo)
        │
  Soroban Contracts
   ├── LendingPool
   ├── LoanManager
   └── CreditScore
        │
  Stellar Blockchain
```

---

## Project Structure

```
stellar-micro-lender/
├── contracts/
│   ├── lending-pool/       # Liquidity deposits, withdrawals, borrowing
│   ├── loan-manager/       # Loan lifecycle: create, repay, default
│   └── credit-score/       # On-chain reputation scoring (300–850)
├── backend/
│   └── src/
│       ├── users/          # User registration, KYC status
│       ├── loans/          # Loan creation, repayment, progressive limits
│       └── repayments/     # Repayment history
├── docker-compose.yml      # PostgreSQL, Redis, backend
└── Cargo.toml              # Rust workspace
```

---

## Smart Contracts

All contracts are written in Rust using the Soroban SDK.

### LendingPool
Manages the USDC liquidity pool that funds loans.

| Function | Description |
|---|---|
| `initialize(admin, token)` | Set up pool with admin and USDC token address |
| `deposit(lender, amount)` | Lender deposits USDC into pool |
| `withdraw(lender, amount)` | Lender withdraws their share |
| `borrow(to, amount)` | Admin draws funds for a loan |
| `receive_repayment(from, amount)` | Returns repaid funds to pool |
| `available_liquidity()` | Returns `total_deposits - total_borrowed` |

### LoanManager
Tracks the full lifecycle of each loan.

| Function | Description |
|---|---|
| `create_loan(borrower, amount, interest_bps, duration_ledgers)` | Issues loan, transfers USDC to borrower |
| `repay(loan_id, payer, amount)` | Accepts repayment, marks loan repaid when full |
| `default_loan(loan_id)` | Marks overdue loan as defaulted |
| `get_loan(loan_id)` | Returns loan state |

Interest is expressed in basis points (e.g. `1000` = 10%).

### CreditScore
Portable on-chain credit reputation, range 300–850.

| Function | Description |
|---|---|
| `get_score(borrower)` | Returns current score (default: 500) |
| `get_profile(borrower)` | Full profile: score, loans repaid/defaulted, totals |
| `reward_repayment(borrower, amount)` | +20 points on repayment |
| `penalize_default(borrower, amount)` | −80 points on default |
| `record_borrow(borrower, amount)` | Tracks total borrowed |

---

## Progressive Lending

Loan limits scale with credit score, starting small to build trust:

| Credit Score | Max Loan |
|---|---|
| 300–549 | $5 |
| 550–649 | $10 |
| 650–749 | $25 |
| 750–850 | $50 |

Repay on time → score increases → borrow more next time.

---

## Backend API

Built with NestJS + TypeORM + PostgreSQL.

Base URL: `http://localhost:3000/api/v1`  
Swagger docs: `http://localhost:3000/docs`

### Users

```
POST   /users              Create user (stellar address, phone, country)
GET    /users              List all users
GET    /users/:id          Get user with loan history
PATCH  /users/:id/kyc      Update KYC status (pending | approved | rejected)
```

### Loans

```
POST   /loans              Request a loan (requires approved KYC)
GET    /loans              List all loans
GET    /loans/:id          Get loan with repayment history
POST   /loans/:id/repay    Submit a repayment
PATCH  /loans/:id/default  Mark loan as defaulted (admin)
```

---

## Getting Started

### Prerequisites

- Rust 1.70+ with `wasm32-unknown-unknown` target
- Node.js 20+
- Docker & Docker Compose

### Run contracts tests

```bash
rustup target add wasm32-unknown-unknown
cargo test
```

### Run backend tests

```bash
cd backend
npm install
npm test
```

### Start full stack

```bash
# Copy env file and configure
cp backend/.env.example backend/.env

# Start PostgreSQL, Redis, and backend
docker compose up
```

### Backend only (local dev)

```bash
cd backend
npm install
npm run start:dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default: 3000) |
| `STELLAR_NETWORK` | `testnet` or `mainnet` |
| `STELLAR_HORIZON_URL` | Horizon API endpoint |
| `LENDING_POOL_CONTRACT_ID` | Deployed LendingPool contract address |
| `LOAN_MANAGER_CONTRACT_ID` | Deployed LoanManager contract address |
| `CREDIT_SCORE_CONTRACT_ID` | Deployed CreditScore contract address |

---

## Loan Lifecycle

```
1. User registers → KYC approved
2. User requests loan → credit score checked → limit enforced
3. LoanManager contract issues loan → USDC transferred to borrower
4. Anchor converts USDC → local mobile money (M-Pesa, MTN MoMo)
5. User repays daily/weekly → CreditScore updated on-chain
6. Full repayment → loan marked REPAID → credit score +20
7. Missed deadline → loan marked DEFAULTED → credit score −80
```

---

## Stellar Standards Used

| Standard | Purpose |
|---|---|
| SEP-10 | Wallet authentication |
| SEP-12 | KYC data submission |
| SEP-24 | Anchor deposit/withdrawal flows |
| SEP-31 | Cross-border payment rails |

---

## Roadmap

**Phase 1 (current — 40% complete)**
- [x] Core Soroban contracts (LendingPool, LoanManager, CreditScore)
- [x] NestJS backend API (Users, Loans, Repayments)
- [x] Progressive lending model
- [x] Docker infrastructure

**Phase 2**
- [ ] Mobile app (Flutter)
- [ ] Anchor integration (M-Pesa, MTN MoMo, OPay)
- [ ] SEP-10/12/24 authentication flows
- [ ] Treasury and Insurance contracts

**Phase 3**
- [ ] AI credit underwriting
- [ ] Group/social lending (Grameen model)
- [ ] WhatsApp/SMS loan bot
- [ ] Multi-country anchor support

**Phase 4**
- [ ] Cross-protocol credit portability
- [ ] Institutional liquidity providers (NGOs, microfinance)
- [ ] On-chain reputation marketplace

---

## Revenue Model

- **Interest spread** — protocol earns 3% (lenders earn 7%, borrowers pay 10%)
- **Cash-out fee** — 0.2–0.5% on anchor conversions
- **Credit API** — sell reputation scoring to third-party lenders

---

## License

MIT
