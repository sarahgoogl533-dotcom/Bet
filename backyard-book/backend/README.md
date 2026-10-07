# Backend (Phase 2)

The frontend already calls this API shape (see `frontend/src/services/api.js`, `remote` adapter).
Set `API_MODE: "remote"` in `frontend/src/config.js` once this exists.

Cookie sessions (httpOnly, Secure, SameSite=Lax). JSON in/out. Errors: `{ "error": "message" }`.

| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register, /login, /logout, /change-password | accounts (argon2/bcrypt hashing, rate limiting, lockout) |
| GET | /api/me, /api/wallet | profile + balances + ledger |
| POST | /api/bets | place bet (server re-prices odds, checks limits/balance, writes ledger in one DB transaction) |
| GET | /api/bets | bet history |
| POST | /api/bets/settle | server settles from verified results |
| POST | /api/payments/deposit | create Paystack transaction; credit wallet ONLY from verified webhook |
| POST | /api/payments/withdraw, /withdraw/:id/cancel | withdrawals (KYC + risk checks) |
| POST | /api/kyc/start | identity verification provider |
| PUT/POST/DELETE | /api/limits, /limits/cool-off, /limits/self-exclude | responsible-gambling controls (server-enforced) |
| POST | /api/promotions/welcome/claim | welcome offer |

Rules the server must own: balances, odds, stakes, settlement, withdrawals, limits. The ledger is append-only.
