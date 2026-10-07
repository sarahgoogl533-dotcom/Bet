# Backyard Book

A polished sportsbook frontend with a server-ready API boundary.

> **Important:** This project is not a live-money gambling service. Payment processing is disabled until a compliant server-side payment integration, licensed operation, KYC/AML, responsible-gambling controls, and verified provider webhooks are in place.

## Project arrangement

```text
backyard-book/
├── index.html
├── src/
│   ├── config.js
│   ├── main.js
│   ├── services/
│   │   ├── api.js
│   │   └── sports.js
│   ├── ui/
│   │   ├── components.js
│   │   └── pages.js
│   └── styles/
│       └── main.css
├── backend/
│   ├── package.json
│   ├── server.js
│   └── .env.example
├── .env.example
├── .gitignore
└── README.md
```

## Frontend

There is no build step. Serve the repository root with any static web server, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Current payment behavior

The payment UI is complete, but `PAYMENTS_ENABLED` is `false`. Deposits and withdrawals do not change the wallet and return a clear unavailable response. This prevents a browser-only implementation from pretending to move real funds.

When a compliant backend is ready, set the frontend to `API_MODE: "remote"` and connect the server to the payment provider. Wallet credits must come only from verified provider webhooks, never from a browser success callback.

## Sports data

The frontend can load public fixture data and use indicative prices when no bookmaker feed is configured. Production odds/results keys should be kept on the server.

## Before public launch

Obtain the required gaming authorization for the target jurisdiction, implement KYC/AML and age checks, responsible-gambling controls, server-side authentication, an append-only ledger, verified payment webhooks, real odds/results feeds, fraud/risk controls, security review, and legal pages.
