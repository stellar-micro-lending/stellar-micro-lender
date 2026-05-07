# Connecting to Stellar Micro-Lender

This guide covers how to connect to and interact with the protocol — from wallet setup to borrowing, repaying, and reading on-chain credit scores.

---

## 1. Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Freighter Wallet](https://www.freighter.app/) | Latest | Browser wallet for Stellar |
| Node.js | 20+ | Run the backend / SDK scripts |
| [Stellar Laboratory](https://laboratory.stellar.org/) | — | Inspect transactions |

---

## 2. Network Configuration

### Testnet (development)

```
Network:      Stellar Testnet
Horizon URL:  https://horizon-testnet.stellar.org
Passphrase:   Test SDF Network ; September 2015
```

Fund a testnet account with free XLM:

```bash
curl "https://friendbot.stellar.org?addr=YOUR_STELLAR_ADDRESS"
```

### Mainnet (production)

```
Network:      Stellar Public
Horizon URL:  https://horizon.stellar.org
Passphrase:   Public Global Stellar Network ; September 2015
```

---

## 3. Connect Your Wallet (Freighter)

### Browser / Web Dashboard

1. Install the [Freighter extension](https://www.freighter.app/)
2. Create or import a Stellar keypair
3. Switch to **Testnet** in Freighter settings
4. Visit `http://localhost:3000/docs` — the Swagger UI

Freighter injects `window.freighter` into the page. To request access:

```js
import freighter from "@stellar/freighter-api";

// Check if Freighter is installed
const isConnected = await freighter.isConnected();

// Request the user's public key
const { address } = await freighter.getAddress();
console.log("Wallet address:", address);

// Sign a transaction
const { signedTxXdr } = await freighter.signTransaction(txXdr, {
  networkPassphrase: "Test SDF Network ; September 2015",
});
```

---

## 4. Register a User

Call the backend API to create a user profile linked to your Stellar address.

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "stellarAddress": "GABC...YOUR_ADDRESS",
    "phoneNumber": "+254700000000",
    "country": "KE"
  }'
```

Response:

```json
{
  "id": "uuid-here",
  "stellarAddress": "GABC...",
  "creditScore": 500,
  "kycStatus": "pending",
  "createdAt": "2026-05-07T09:00:00.000Z"
}
```

---

## 5. Complete KYC

KYC must be approved before borrowing. In production this integrates with SEP-12. For local dev, approve manually:

```bash
curl -X PATCH http://localhost:3000/api/v1/users/{userId}/kyc \
  -H "Content-Type: application/json" \
  -d '{ "kycStatus": "approved" }'
```

---

## 6. Check Your Credit Score

Your starting score is **500**. It increases with repayments (+20) and drops on defaults (−80).

```bash
curl http://localhost:3000/api/v1/users/{userId}
```

Or query the CreditScore contract directly using the Stellar SDK:

```js
import { Contract, SorobanRpc, TransactionBuilder, Networks, BASE_FEE } from "@stellar/stellar-sdk";

const server = new SorobanRpc.Server("https://soroban-testnet.stellar.org");
const contract = new Contract(process.env.CREDIT_SCORE_CONTRACT_ID);

const account = await server.getAccount(yourAddress);
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(contract.call("get_score", /* Address */ yourAddress))
  .setTimeout(30)
  .build();

const result = await server.simulateTransaction(tx);
console.log("Credit score:", result.result.retval.value());
```

---

## 7. Request a Loan

Loan limits are enforced by your credit score:

| Score | Max Loan |
|---|---|
| 300–549 | $5 |
| 550–649 | $10 |
| 650–749 | $25 |
| 750–850 | $50 |

```bash
curl -X POST http://localhost:3000/api/v1/loans \
  -H "Content-Type: application/json" \
  -d '{
    "borrowerId": "your-user-uuid",
    "amount": 7,
    "dueDate": "2026-06-07T00:00:00.000Z"
  }'
```

Response:

```json
{
  "id": "loan-uuid",
  "amount": "7",
  "interestRate": "10.00",
  "dueDate": "2026-06-07T00:00:00.000Z",
  "status": "active"
}
```

The backend calls `LoanManager.create_loan()` on-chain and transfers USDC to your wallet.

---

## 8. Repay a Loan

Partial repayments are accepted. The loan is marked **repaid** once the full principal + 10% interest is covered.

```bash
curl -X POST http://localhost:3000/api/v1/loans/{loanId}/repay \
  -H "Content-Type: application/json" \
  -d '{
    "payerId": "your-user-uuid",
    "amount": 7.7
  }'
```

On full repayment your credit score increases by **+20 points**.

---

## 9. Deposit Liquidity (Lenders)

Lenders deposit USDC into the LendingPool contract to earn yield.

```js
import { Contract, SorobanRpc, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, Address } from "@stellar/stellar-sdk";

const server = new SorobanRpc.Server("https://soroban-testnet.stellar.org");
const pool = new Contract(process.env.LENDING_POOL_CONTRACT_ID);

const account = await server.getAccount(lenderAddress);
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(pool.call(
    "deposit",
    new Address(lenderAddress).toScVal(),
    nativeToScVal(100_000_000, { type: "i128" }) // 10 USDC (7 decimals)
  ))
  .setTimeout(30)
  .build();

const prepared = await server.prepareTransaction(tx);
const { signedTxXdr } = await freighter.signTransaction(prepared.toXDR(), {
  networkPassphrase: "Test SDF Network ; September 2015",
});

const response = await server.sendTransaction(
  TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET)
);
console.log("Deposit tx:", response.hash);
```

---

## 10. Check Pool Liquidity

```js
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(pool.call("available_liquidity"))
  .setTimeout(30)
  .build();

const result = await server.simulateTransaction(tx);
const liquidity = result.result.retval.value(); // in stroops
console.log("Available liquidity:", Number(liquidity) / 1e7, "USDC");
```

---

## 11. API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/users` | Register user |
| GET | `/api/v1/users/:id` | Get user + loan history |
| PATCH | `/api/v1/users/:id/kyc` | Update KYC status |
| POST | `/api/v1/loans` | Request a loan |
| GET | `/api/v1/loans/:id` | Get loan details |
| POST | `/api/v1/loans/:id/repay` | Submit repayment |
| PATCH | `/api/v1/loans/:id/default` | Mark loan defaulted (admin) |

Full interactive docs: **`http://localhost:3000/docs`**

---

## 12. Useful Links

- [Stellar Developer Docs](https://developers.stellar.org)
- [Soroban SDK (Rust)](https://docs.rs/soroban-sdk)
- [Stellar SDK (JS)](https://stellar.github.io/js-stellar-sdk/)
- [Freighter API](https://docs.freighter.app/)
- [Stellar Testnet Explorer](https://stellar.expert/explorer/testnet)
- [Friendbot (testnet faucet)](https://friendbot.stellar.org)
