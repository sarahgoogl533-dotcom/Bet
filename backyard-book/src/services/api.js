/* API layer. The UI only ever talks to BB.api.
   - API_MODE "local": a built-in dev backend (accounts, ledger, bets, payments sandbox) kept in this browser.
   - API_MODE "remote": the same calls go to your real server (see remote adapter below).
   Money rules live HERE, never in the UI. In production they must run on the server. */
(function (BB) {
  const C = BB.config;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const rid = p => p + Math.random().toString(36).slice(2, 9).toUpperCase();
  const M = n => C.CURRENCY + " " + r2(n).toFixed(2);
  const DAY = 864e5, KEY = "bb_db_v1", mem = { users: {}, session: null };
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, session: null }; } catch (e) { return mem; } },
    set(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { Object.assign(mem, db); } }
  };

  async function hash(pw, salt) {
    const data = new TextEncoder().encode(salt + pw);
    if (globalThis.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
    }
    let h = 5381; for (const b of data) h = ((h << 5) + h + b) >>> 0; return "x" + h;
  }
  function need() {
    const db = store.get(), u = db.session && db.users[db.session];
    if (!u) throw new Error("Please log in.");
    return { db, u };
  }
  function post(u, o) {
    const before = r2(u.cash + u.bonus);
    u.cash = r2(u.cash + (o.cash || 0)); u.bonus = r2(u.bonus + (o.bonus || 0));
    const e = { id: rid("TX"), type: o.type, amount: r2((o.cash || 0) + (o.bonus || 0)), before, after: r2(u.cash + u.bonus),
      status: o.status || "completed", ref: o.ref || rid("REF"), related: o.related || "", note: o.note || "", method: o.method || "", ts: Date.now() };
    u.ledger.unshift(e); return e;
  }
  function guard(u) {
    const n = Date.now();
    if (u.excludeUntil > n) throw new Error("Your account is self-excluded until " + (u.excludeUntil > n + 3650 * DAY ? "further notice" : new Date(u.excludeUntil).toLocaleDateString()) + ".");
    if (u.coolUntil > n) throw new Error("Cool-off is active until " + new Date(u.coolUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ".");
  }
  function progressWithdrawals(u) {
    const n = Date.now();
    u.ledger.forEach(e => {
      if (e.type !== "Withdrawal" || ["completed", "cancelled"].includes(e.status)) return;
      const age = n - e.ts; e.status = age < 5000 ? "pending" : age < 13000 ? "processing" : "completed";
    });
  }
  function view(u) {
    progressWithdrawals(u);
    const n = Date.now(), dep = u.ledger.filter(e => e.type === "Deposit" && e.ts > n - DAY).reduce((a, e) => a + e.amount, 0);
    return { user: { id: u.id, name: u.name, email: u.email }, cash: u.cash, bonus: u.bonus, bonusReq: u.bonusReq, bonusWag: u.bonusWag,
      kyc: u.kyc, limits: u.limits, coolUntil: u.coolUntil, excludeUntil: u.excludeUntil, promoOptIn: u.promoOptIn, promoClaimed: u.promoClaimed,
      depositedToday: r2(dep), ledger: u.ledger.slice(0, 200) };
  }
  function releaseBonus(u) {
    if (u.bonusReq > 0 && u.bonusWag >= u.bonusReq) {
      if (u.bonus > 0) post(u, { type: "Bonus released", cash: u.bonus, bonus: -u.bonus, note: "Wagering requirement met" });
      u.bonusReq = 0; u.bonusWag = 0;
    }
  }

  const local = {
    async register({ name, email, password, over18 }) {
      email = String(email || "").trim().toLowerCase(); name = String(name || "").trim();
      if (!name) throw new Error("Enter your name.");
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
      if (String(password || "").length < 8) throw new Error("Password needs at least 8 characters.");
      if (!over18) throw new Error("You must confirm you are of legal age and accept the Terms.");
      const db = store.get(); if (db.users[email]) throw new Error("That email already has an account. Log in instead.");
      const salt = rid("S");
      db.users[email] = { id: rid("U"), name, email, salt, hash: await hash(password, salt), created: Date.now(), cash: 0, bonus: 0, bonusReq: 0, bonusWag: 0,
        kyc: false, limits: { deposit: C.DEFAULT_DEP_LIMIT, loss: null }, coolUntil: 0, excludeUntil: 0, promoOptIn: false, promoClaimed: false, ledger: [], bets: [], fails: 0, lockUntil: 0 };
      db.session = email; store.set(db); return view(db.users[email]);
    },
    async login({ email, password }) {
      email = String(email || "").trim().toLowerCase(); const db = store.get(), u = db.users[email];
      if (u && u.lockUntil > Date.now()) throw new Error("Too many attempts. Try again in a few minutes.");
      if (!u || (await hash(password || "", u.salt)) !== u.hash) {
        if (u) { u.fails = (u.fails || 0) + 1; if (u.fails >= 5) { u.lockUntil = Date.now() + 5 * 6e4; u.fails = 0; } store.set(db); }
        throw new Error("Email or password is incorrect.");
      }
      u.fails = 0; db.session = email; store.set(db); return view(u);
    },
    async logout() { const db = store.get(); db.session = null; store.set(db); },
    async me() { const db = store.get(), u = db.session && db.users[db.session]; if (!u) return null; const v = view(u); store.set(db); return v; },
    async wallet() { const { db, u } = need(); const v = view(u); store.set(db); return v; },
    async changePassword({ oldPassword, newPassword }) {
      const { db, u } = need();
      if ((await hash(oldPassword || "", u.salt)) !== u.hash) throw new Error("Current password is incorrect.");
      if (String(newPassword || "").length < 8) throw new Error("New password needs at least 8 characters.");
      u.salt = rid("S"); u.hash = await hash(newPassword, u.salt); store.set(db);
    },
    async verifyIdentity() {
      if (!C.IDENTITY_ENABLED) throw new Error("Identity verification is currently unavailable.");
      const { db, u } = need(); await sleep(1600); u.kyc = true; store.set(db); return view(u); },

    async deposit({ amount, method }) {
      if (!C.PAYMENTS_ENABLED) throw new Error("Payments are currently unavailable.");
      const { db, u } = need(); guard(u); amount = r2(Number(amount));
      if (!(amount >= C.MIN_DEP)) throw new Error("Minimum deposit is " + M(C.MIN_DEP) + ".");
      if (amount > C.MAX_DEP) throw new Error("Maximum single deposit is " + M(C.MAX_DEP) + ".");
      const used = u.ledger.filter(e => e.type === "Deposit" && e.ts > Date.now() - DAY).reduce((a, e) => a + e.amount, 0);
      if (u.limits.deposit != null && used + amount > u.limits.deposit) throw new Error("This would pass your daily deposit limit of " + M(u.limits.deposit) + ". You can deposit up to " + M(Math.max(0, u.limits.deposit - used)) + " today.");
      await sleep(1800); // provider (test mode) round-trip
      const ref = "PSK_TEST_" + rid(""); const e = post(u, { type: "Deposit", cash: amount, ref, method });
      let bonus = 0;
      if (u.promoOptIn && !u.promoClaimed && amount >= C.WELCOME.minDep) {
        bonus = Math.min(r2(amount * C.WELCOME.pct / 100), C.WELCOME.max);
        post(u, { type: "Bonus", bonus, ref, related: e.id, note: "Welcome offer, " + C.WELCOME.wager + "x wagering" });
        u.bonusReq = r2(u.bonusReq + bonus * C.WELCOME.wager); u.promoClaimed = true;
      }
      store.set(db); return { ref, bonus, wallet: view(u) };
    },
    async withdraw({ amount, method, dest }) {
      if (!C.PAYMENTS_ENABLED) throw new Error("Withdrawals are currently unavailable.");
      const { db, u } = need(); amount = r2(Number(amount));
      if (!u.kyc) throw new Error("Verify your identity before withdrawing.");
      if (!(amount >= C.MIN_WD)) throw new Error("Minimum withdrawal is " + M(C.MIN_WD) + ".");
      if (amount > u.cash) throw new Error(u.bonus > 0 ? "Only cash can be withdrawn. Bonus funds are locked until wagering is complete." : "Amount is more than your balance.");
      if (!String(dest || "").trim()) throw new Error("Enter where to send the funds.");
      await sleep(900); const ref = "PSK_TEST_" + rid("");
      post(u, { type: "Withdrawal", cash: -amount, status: "pending", ref, method, note: "To ••••" + String(dest).replace(/\D/g, "").slice(-4) });
      store.set(db); return { ref, wallet: view(u) };
    },
    async cancelWithdrawal(id) {
      const { db, u } = need(); progressWithdrawals(u); const e = u.ledger.find(x => x.id === id);
      if (!e || e.status !== "pending") throw new Error("This withdrawal can no longer be cancelled.");
      e.status = "cancelled"; post(u, { type: "Withdrawal reversal", cash: -e.amount, related: e.id, note: "Cancelled by player" });
      store.set(db); return view(u);
    },

    async claimOffer() { const { db, u } = need(); if (u.promoClaimed) throw new Error("Welcome offer already claimed."); u.promoOptIn = true; store.set(db); return view(u); },
    async setLimits({ deposit, loss }) {
      const { db, u } = need(); const d = deposit === "" || deposit == null ? null : Number(deposit), l = loss === "" || loss == null ? null : Number(loss);
      if ((d != null && !(d >= 5)) || (l != null && !(l >= 5))) throw new Error("Limits must be at least " + M(5) + ".");
      u.limits = { deposit: d, loss: l }; store.set(db); return view(u);
    },
    async coolOff(minutes) { const { db, u } = need(); u.coolUntil = Date.now() + minutes * 6e4; store.set(db); return view(u); },
    async endCoolOff() { const { db, u } = need(); u.coolUntil = 0; store.set(db); return view(u); },
    async selfExclude(days) { const { db, u } = need(); u.excludeUntil = Date.now() + (days === "perm" ? 3650 * 2 * DAY : days * DAY); store.set(db); return view(u); },

    async placeBet({ legs, stake, type }) {
      const { db, u } = need(); guard(u); stake = r2(Number(stake));
      if (!legs || !legs.length) throw new Error("Your slip is empty.");
      if (!(stake >= C.MIN_STAKE)) throw new Error("Minimum stake is " + M(C.MIN_STAKE) + ".");
      if (stake > C.MAX_STAKE) throw new Error("Maximum stake is " + M(C.MAX_STAKE) + ".");
      if (type === "acc" && legs.length < 2) throw new Error("An accumulator needs at least 2 selections.");
      if (new Set(legs.map(l => l.eventId)).size !== legs.length) throw new Error("You can't pick two outcomes from the same match in one accumulator.");
      if (legs.some(l => l.start <= Date.now())) throw new Error("A match on your slip has started. Remove it and try again.");
      if (stake > u.cash + u.bonus) throw new Error("Insufficient balance. Deposit to continue.");
      if (u.limits.loss != null) {
        const t0 = new Date().setHours(0, 0, 0, 0);
        const staked = u.bets.filter(b => b.placed >= t0).reduce((a, b) => a + b.stake, 0);
        const ret = u.ledger.filter(e => ["Winning bet", "Bet refund"].includes(e.type) && e.ts >= t0).reduce((a, e) => a + e.amount, 0);
        if (staked - ret + stake > u.limits.loss) throw new Error("This stake would pass your daily loss limit of " + M(u.limits.loss) + ".");
      }
      const fromCash = Math.min(u.cash, stake), fromBonus = r2(stake - fromCash), ref = rid("B");
      post(u, { type: "Bet", cash: -fromCash, bonus: -fromBonus, ref, related: ref, note: legs.map(l => l.pick).join(" + ") });
      const bet = { id: ref, type: type === "acc" ? "acc" : "single", stake, odds: Math.round(legs.reduce((a, l) => a * l.odds, 1) * 100) / 100,
        legs: legs.map(l => ({ eventId: l.eventId, key: l.key, pick: l.pick, title: l.title, odds: l.odds, start: l.start })), status: "open", placed: Date.now(), paid: 0 };
      u.bets.unshift(bet);
      if (u.bonusReq > 0) { u.bonusWag = r2(u.bonusWag + stake); releaseBonus(u); }
      store.set(db); return { bet, wallet: view(u) };
    },
    async bets() { const { u } = need(); return u.bets; },
    async settleBets(RES) {
      const { db, u } = need(); const changed = [];
      u.bets.forEach(b => {
        if (b.status !== "open") return;
        const lost = b.legs.some(l => RES[l.eventId] !== undefined && RES[l.eventId] !== "V" && RES[l.eventId] !== l.key);
        if (lost) { b.status = "lost"; changed.push(b); return; }
        if (b.legs.some(l => RES[l.eventId] === undefined)) return;
        const live = b.legs.filter(l => RES[l.eventId] !== "V");
        if (!live.length) { b.status = "void"; b.paid = b.stake; post(u, { type: "Bet refund", cash: b.stake, ref: b.id, related: b.id, note: "Void: " + b.legs.map(l => l.pick).join(" + ") }); }
        else { b.status = "won"; b.paid = r2(b.stake * (Math.round(live.reduce((a, l) => a * l.odds, 1) * 100) / 100)); post(u, { type: "Winning bet", cash: b.paid, ref: b.id, related: b.id, note: b.legs.map(l => l.pick).join(" + ") }); }
        changed.push(b);
      });
      if (changed.length) store.set(db); return { changed, wallet: view(u) };
    }
  };

  /* Remote adapter: same method names, sent to your backend (Phase 2). Cookies carry the session. */
  async function req(method, path, body) {
    const r = await fetch(C.API_URL + path, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Request failed (" + r.status + ")"); return j;
  }
  const remote = {
    register: b => req("POST", "/auth/register", b), login: b => req("POST", "/auth/login", b), logout: () => req("POST", "/auth/logout"),
    me: () => req("GET", "/me").catch(() => null), wallet: () => req("GET", "/wallet"), changePassword: b => req("POST", "/auth/change-password", b),
    verifyIdentity: () => req("POST", "/kyc/start"), deposit: b => req("POST", "/payments/deposit", b), withdraw: b => req("POST", "/payments/withdraw", b),
    cancelWithdrawal: id => req("POST", "/payments/withdraw/" + id + "/cancel"), claimOffer: () => req("POST", "/promotions/welcome/claim"),
    setLimits: b => req("PUT", "/limits", b), coolOff: m => req("POST", "/limits/cool-off", { minutes: m }), endCoolOff: () => req("DELETE", "/limits/cool-off"),
    selfExclude: d => req("POST", "/limits/self-exclude", { days: d }), placeBet: b => req("POST", "/bets", b), bets: () => req("GET", "/bets"),
    settleBets: () => req("POST", "/bets/settle") // server settles from verified results; the client only asks for a refresh
  };
  BB.api = C.API_MODE === "remote" ? remote : local;
})(window.BB);
