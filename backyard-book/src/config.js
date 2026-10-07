/* Backyard Book: frontend configuration.
   Nothing secret belongs in this file: it is shipped to every browser.
   Private keys (odds, payments, auth) live on the backend (see backend/.env.example). */
window.BB = window.BB || {};
BB.config = {
  APP: "Backyard Book",
  CURRENCY: "GHS",
  PAYMENTS_ENABLED: false,
  IDENTITY_ENABLED: false,        // Enable only after a server-side payment provider is connected.
  API_MODE: "local",              // "local" = built-in dev backend stored in this browser | "remote" = your real backend at API_URL
  API_URL: "/api",
  PAYMENT_PROVIDER: "Paystack",   // sandbox/test keys only while TEST_ENV is true

  // Sports data (public, rate-limited). Production should call these from the backend.
  TSDB_KEY: "3",                  // TheSportsDB free test key: get your own at thesportsdb.com
  TSDB_V2_KEY: "",                // premium key => live scores
  ODDS_API_KEY: "",               // the-odds-api.com key => real bookmaker odds (move to backend before launch)

  MIN_STAKE: 1, MAX_STAKE: 5000,
  MIN_DEP: 5, MAX_DEP: 10000, MIN_WD: 10,
  DEFAULT_DEP_LIMIT: 5000,
  WELCOME: { pct: 100, max: 500, wager: 3, minDep: 20 },
  REALITY_CHECK_MIN: 30
};
