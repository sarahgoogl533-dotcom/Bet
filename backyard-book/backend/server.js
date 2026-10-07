import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT || 8787);
const paymentsLive = process.env.PAYMENTS_LIVE === 'true';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'backyard-book-api' }));

// Account/session endpoints are intentionally left server-owned.
app.post('/api/auth/register', (_req, res) => res.status(501).json({ error: 'Account service is not connected yet.' }));
app.post('/api/auth/login', (_req, res) => res.status(501).json({ error: 'Account service is not connected yet.' }));
app.post('/api/auth/logout', (_req, res) => res.json({ ok: true }));
app.get('/api/me', (_req, res) => res.status(401).json({ error: 'Not signed in.' }));
app.get('/api/wallet', (_req, res) => res.status(501).json({ error: 'Wallet service is not connected yet.' }));

// Never credit a balance from a browser request. A production implementation
// must credit only after verifying the payment provider's signed webhook.
app.post('/api/payments/deposit', (_req, res) => {
  if (!paymentsLive) return res.status(503).json({ error: 'Payments are currently unavailable.' });
  return res.status(501).json({ error: 'Payment provider integration is not configured.' });
});
app.post('/api/payments/withdraw', (_req, res) => {
  if (!paymentsLive) return res.status(503).json({ error: 'Withdrawals are currently unavailable.' });
  return res.status(501).json({ error: 'Payment provider integration is not configured.' });
});

app.post('/api/bets', (_req, res) => res.status(501).json({ error: 'Betting ledger is not connected yet.' }));
app.get('/api/bets', (_req, res) => res.status(501).json({ error: 'Betting ledger is not connected yet.' }));
app.post('/api/bets/settle', (_req, res) => res.status(501).json({ error: 'Settlement service is not connected yet.' }));

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
app.listen(port, () => console.log(`Backyard Book API listening on :${port}`));
