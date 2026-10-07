/* App: state, routing, events, timers. */
(function (BB) {
  const C = BB.config, U = BB.ui, $ = U.$, esc = U.esc, money = U.money, SP = () => BB.sports;
  const S = BB.S = { user: null, w: null, bets: [], route: "home", param: "", sel: [], mode: "single", stakes: {}, pstake: "", sport: "All", comp: "All", q: "", favOnly: false,
    favs: new Set(), wtab: "deposit", dm: "momo", wm: "momo", txf: "All", betTab: "open", slipOpen: false, authTab: "up", reality: C.REALITY_CHECK_MIN, pwd: null, pex: null };
  const ROUTES = ["home", "sports", "live", "match", "bets", "wallet", "promotions", "account"];
  const mask = d => "••••" + String(d).replace(/\D/g, "").slice(-4);

  /* ---------- routing + rendering ---------- */
  function parseRoute() {
    const [, r, p] = (location.hash || "#/home").split("/"); S.route = ROUTES.includes(r) ? r : "home"; S.param = p ? decodeURIComponent(p) : ""; S.slipOpen = false;
  }
  function renderHeader() { $("hdr").innerHTML = U.header(); $("bnav").innerHTML = U.bottomNav(); }
  function renderPage() {
    const el = $("page"); if (!S.w) return; el.innerHTML = BB.pages[S.route](S);
    if ($("search")) { const si = $("search"); si.oninput = () => { S.q = si.value; const c = si.selectionStart; renderPage(); const n = $("search"); n.focus(); n.setSelectionRange(c, c); }; }
  }
  function render() {
    if (!S.user) { $("app").hidden = true; $("auth").hidden = false; $("auth").innerHTML = BB.pages.auth(S); return; }
    $("auth").hidden = true; $("app").hidden = false; renderHeader(); renderPage(); U.renderSlip();
  }
  function go(h) { if (location.hash === h) { parseRoute(); render(); } else location.hash = h; }
  window.addEventListener("hashchange", () => { parseRoute(); render(); window.scrollTo(0, 0); });

  async function refreshWallet(quiet) {
    const before = S.w ? S.w.cash + S.w.bonus : null;
    S.w = await BB.api.wallet(); S.bets = await BB.api.bets(); renderHeader();
    if (before !== null && before !== S.w.cash + S.w.bonus) { const b = $("balpill"); if (b) { b.classList.add("flash"); setTimeout(() => b.classList.remove("flash"), 900); } }
    if (!quiet) renderPage();
  }

  /* ---------- slip logic ---------- */
  function syncSlipOdds() {
    S.sel.forEach(s => { const e = SP().EV[s.e]; if (!e) return; const cur = e.odds[s.k]; if (cur !== s.odds) s.newOdds = cur; else delete s.newOdds; });
  }
  function toggleOdd(id, k) {
    const e = SP().EV[id]; if (!e || SP().phase(e) !== "up") return U.toast("Betting is closed for this match.");
    const i = S.sel.findIndex(s => s.e === id);
    if (i > -1 && S.sel[i].k === k) S.sel.splice(i, 1); else if (i > -1) S.sel[i] = { e: id, k, odds: e.odds[k] }; else { S.sel.push({ e: id, k, odds: e.odds[k] }); const b = document.querySelector(".slip-bar"); if (b) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } }
    document.querySelectorAll(`.odd[data-e="${CSS.escape(id)}"]`).forEach(b => b.setAttribute("aria-pressed", S.sel.some(s => s.e === id && s.k === b.dataset.k)));
    U.renderSlip();
  }
  function legsPayload() { return S.sel.map(s => { const e = SP().EV[s.e]; return { eventId: s.e, key: s.k, pick: U.pick(s), title: e.title, odds: s.odds, start: e.start }; }); }
  function askConfirm() {
    syncSlipOdds(); const v = U.slipValidate();
    if (S.sel.some(s => s.newOdds)) { U.renderSlip(); return U.toast("Odds changed. Review and accept to continue."); }
    if (!v.ok) { U.renderSlip(); return; }
    const rows = S.mode === "acc"
      ? S.sel.map(s => `<div><span>${esc(U.pick(s))}</span><b>${s.odds.toFixed(2)}</b></div>`).join("") + `<div><span>Combined odds</span><b>${v.c.odds.toFixed(2)}</b></div>`
      : S.sel.map(s => `<div><span>${esc(U.pick(s))} @ ${s.odds.toFixed(2)}</span><b>${money(U.stakeOf(s.e))}</b></div>`).join("");
    U.openModal(`<h3>Confirm your bet</h3><p>Check the details before you place it.</p><div class="receipt">${rows}<div><span>Total stake</span><b>${money(v.c.stake)}</b></div><div><span>Potential return</span><b class="gold">${money(v.c.ret)}</b></div></div>
      <div class="actions"><button class="btn" data-act="confirmplace">Confirm bet</button><button class="btn ghost" data-act="mclose">Back</button></div>`);
  }
  async function placeNow() {
    U.openModal(`<div class="spin"></div><h3 style="text-align:center">Placing your bet…</h3>`);
    try {
      const ids = [];
      if (S.mode === "acc") { const r = await BB.api.placeBet({ type: "acc", stake: U.slipCalc().stake, legs: legsPayload() }); ids.push(r.bet.id); }
      else for (const s of S.sel.slice()) {
        const e = SP().EV[s.e], r = await BB.api.placeBet({ type: "single", stake: U.stakeOf(s.e), legs: [{ eventId: s.e, key: s.k, pick: U.pick(s), title: e.title, odds: s.odds, start: e.start }] });
        ids.push(r.bet.id); S.sel = S.sel.filter(x => x.e !== s.e);
      }
      S.sel = []; S.stakes = {}; S.pstake = ""; S.slipOpen = false; await refreshWallet(true);
      U.openModal(`<div class="tick">✓</div><h3 style="text-align:center">Bet placed</h3><div class="receipt">${ids.map(i => `<div><span>Bet ID</span><b>${esc(i)}</b></div>`).join("")}<div><span>New balance</span><b>${money(S.w.cash + S.w.bonus)}</b></div></div>
        <div class="actions"><a class="btn" href="#/bets" data-act="mclose">View my bets</a><button class="btn ghost" data-act="mclose">Keep betting</button></div>`);
      render();
    } catch (e) { await refreshWallet(true).catch(() => {}); U.openModal(`<h3>Bet not placed</h3><p>${esc(e.message)}</p><div class="actions"><button class="btn" data-act="mclose">OK</button></div>`); render(); }
  }

  /* ---------- results / settlement ---------- */
  async function checkResults(manual) {
    if (!S.user) return;
    const pend = [...new Set(S.bets.filter(b => b.status === "open").flatMap(b => b.legs.map(l => l.eventId)))].filter(id => SP().RES[id] === undefined && !String(id).startsWith("sample") && SP().EV[id] && Date.now() > SP().EV[id].start + 3600e3).slice(0, 8);
    for (const id of pend) { try { const r = await SP().fetchResult(id); if (r) SP().RES[id] = r; } catch (e) {} }
    try {
      const out = await BB.api.settleBets(SP().RES); await refreshWallet(); const won = (out.changed || []).filter(b => b.status === "won");
      if (won.length) U.toast("You won " + money(won.reduce((a, b) => a + b.paid, 0)) + "! 🎉");
      else if (manual) U.toast(pend.length ? "Results checked." : "No bets are waiting on results.");
    } catch (e) { if (manual) U.toast(e.message); }
  }

  /* ---------- reality check ---------- */
  let rcTimer;
  function startReality() {
    clearInterval(rcTimer); if (!S.reality) return;
    rcTimer = setInterval(() => { if (S.user && !U.modalOpen()) U.openModal(`<h3>Reality check</h3><p>You've been playing for ${S.reality} minutes. Take a moment to check how you're doing.</p><div class="receipt"><div><span>Balance</span><b>${money(S.w.cash + S.w.bonus)}</b></div></div><div class="actions"><button class="btn" data-act="mclose">Continue</button><a class="btn ghost" href="#/account" data-act="mclose">Take a break</a></div>`); }, S.reality * 6e4);
  }

  /* ---------- actions ---------- */
  const val = id => ($(id) ? $(id).value.trim() : "");
  const A = {
    ovclose(ev) { if (ev.target.classList.contains("ov")) U.closeModal(); }, mclose() { U.closeModal(); },
    odd(el) { toggleOdd(el.dataset.e, el.dataset.k); },
    fav(el) { const id = el.dataset.e; S.favs.has(id) ? S.favs.delete(id) : S.favs.add(id); renderPage(); },
    match(el) { go("#/match/" + encodeURIComponent(el.dataset.e)); },
    sport(el) { S.sport = el.dataset.s; S.comp = "All"; renderPage(); }, goSport(el) { S.sport = el.dataset.s; S.comp = "All"; }, goComp(el) { S.comp = el.dataset.c; S.sport = "All"; },
    favonly() { S.favOnly = !S.favOnly; renderPage(); },
    async refresh() { U.toast("Refreshing…"); await SP().load(); syncSlipOdds(); render(); },
    rm(el) { S.sel = S.sel.filter(s => s.e !== el.dataset.e); document.querySelectorAll(`.odd[data-e="${CSS.escape(el.dataset.e)}"]`).forEach(b => b.setAttribute("aria-pressed", "false")); U.renderSlip(); },
    clear() { S.sel = []; S.stakes = {}; S.pstake = ""; render(); },
    mode(el) { S.mode = el.dataset.m; U.renderSlip(); },
    preset(el) { const v = Number(el.dataset.v); if (S.mode === "acc") S.pstake = String((Number(S.pstake) || 0) + v); else S.sel.forEach(s => { S.stakes[s.e] = String((Number(S.stakes[s.e]) || 0) + v); }); U.renderSlip(); },
    accept() { S.sel.forEach(s => { if (s.newOdds) { s.odds = s.newOdds; delete s.newOdds; } }); U.renderSlip(); },
    place() { askConfirm(); }, confirmplace() { placeNow(); },
    slipToggle() { S.slipOpen = !S.slipOpen; U.renderSlip(); },
    betTab(el) { S.betTab = el.dataset.t; renderPage(); }, checkResults() { checkResults(true); },
    wt(el) { S.wtab = el.dataset.v; if (S.route !== "wallet") go("#/wallet"); else renderPage(); },
    dm(el) { S.dm = el.dataset.v; renderPage(); }, wm(el) { S.wm = el.dataset.v; renderPage(); }, txf(el) { S.txf = el.dataset.v; renderPage(); },
    dpreset(el) { $("dAmt").value = el.dataset.v; },
    goDeposit() { S.wtab = "deposit"; },
    async deposit() {
      const err = $("derr"); err.textContent = ""; const amount = Number(val("dAmt"));
      if (S.dm === "momo" && val("dphone").replace(/\D/g, "").length < 9) return (err.textContent = "Enter a valid mobile number.");
      if (!(amount > 0)) return (err.textContent = "Enter an amount.");
      if (!C.PAYMENTS_ENABLED) return U.openModal(`<h3>Payments unavailable</h3><p>Payment processing is not available yet. Your account and betting interface are ready, but no funds will be moved until the payment service is connected.</p><div class="actions"><button class="btn" data-act="mclose">OK</button></div>`);
      U.openModal(`<div class="spin"></div><h3 style="text-align:center">${S.dm === "momo" ? "Approve the prompt on your phone" : "Redirecting to " + esc(C.PAYMENT_PROVIDER)}</h3><p style="text-align:center">Please don't close this page.</p>`);
      try {
        const r = await BB.api.deposit({ amount, method: S.dm === "momo" ? "Mobile Money" : S.dm === "card" ? "Card" : "Bank", phone: val("dphone") }); await refreshWallet(true);
        U.openModal(`<div class="tick">✓</div><h3 style="text-align:center">Deposit successful</h3><div class="receipt"><div><span>Amount</span><b>${money(amount)}</b></div>${r.bonus ? `<div><span>Welcome bonus</span><b class="gold">${money(r.bonus)}</b></div>` : ""}<div><span>Reference</span><b>${esc(r.ref)}</b></div><div><span>New balance</span><b>${money(S.w.cash + S.w.bonus)}</b></div></div><div class="actions"><button class="btn" data-act="mclose">Done</button></div>`);
        render();
      } catch (e) { U.closeModal(); const x = $("derr"); if (x) x.textContent = e.message; }
    },
    withdraw() {
      const err = $("werr"); err.textContent = ""; const amount = Number(val("wAmt")), dest = val("wDest");
      if (!S.w.kyc) return (err.textContent = "Verify your identity first.");
      if (!(amount >= C.MIN_WD)) return (err.textContent = "Minimum withdrawal is " + money(C.MIN_WD) + ".");
      if (amount > S.w.cash) return (err.textContent = S.w.bonus ? "Only cash can be withdrawn. Bonus funds are locked." : "Amount is more than your balance.");
      if (dest.replace(/\D/g, "").length < 6) return (err.textContent = "Enter a valid " + (S.wm === "momo" ? "mobile number." : "account number."));
      S.pwd = { amount, dest, method: S.wm === "momo" ? "Mobile Money" : "Bank" };
      U.openModal(`<h3>Confirm withdrawal</h3><div class="receipt"><div><span>Amount</span><b>${money(amount)}</b></div><div><span>To</span><b>${S.pwd.method} ${mask(dest)}</b></div></div><div class="actions"><button class="btn" data-act="confirmwd">Confirm withdrawal</button><button class="btn ghost" data-act="mclose">Back</button></div>`);
    },
    async confirmwd() {
      U.openModal(`<div class="spin"></div><h3 style="text-align:center">Submitting withdrawal…</h3>`);
      try { const r = await BB.api.withdraw(S.pwd); S.wtab = "history"; S.txf = "Withdrawals"; await refreshWallet(true);
        U.openModal(`<div class="tick">✓</div><h3 style="text-align:center">Withdrawal requested</h3><div class="receipt"><div><span>Amount</span><b>${money(S.pwd.amount)}</b></div><div><span>Reference</span><b>${esc(r.ref)}</b></div><div><span>Status</span><b>Pending</b></div></div><p style="text-align:center">Track it in History. You can cancel while it's Pending.</p><div class="actions"><button class="btn" data-act="mclose">Done</button></div>`); render();
      } catch (e) { U.openModal(`<h3>Withdrawal failed</h3><p>${esc(e.message)}</p><div class="actions"><button class="btn" data-act="mclose">OK</button></div>`); }
    },
    async cancelwd(el) { try { S.w = await BB.api.cancelWithdrawal(el.dataset.id); await refreshWallet(); U.toast("Withdrawal cancelled. Funds returned."); } catch (e) { U.toast(e.message); } },
    async kyc() {
      if (!C.IDENTITY_ENABLED) return U.openModal(`<h3>Verification unavailable</h3><p>Identity verification will be available when the secure backend is connected.</p><div class="actions"><button class="btn" data-act="mclose">OK</button></div>`);
      U.openModal(`<div class="spin"></div><h3 style="text-align:center">Verifying your identity…</h3><p style="text-align:center">This takes a few moments.</p>`);
      try { S.w = await BB.api.verifyIdentity(); U.openModal(`<div class="tick">✓</div><h3 style="text-align:center">Identity verified</h3><div class="actions"><button class="btn" data-act="mclose">Continue</button></div>`); render(); } catch (e) { U.openModal(`<h3>Verification failed</h3><p>${esc(e.message)}</p><div class="actions"><button class="btn" data-act="mclose">OK</button></div>`); }
    },
    async claim() { try { S.w = await BB.api.claimOffer(); U.toast("Offer activated. Make a deposit to receive it."); renderPage(); } catch (e) { U.toast(e.message); } },
    async changepw() { const x = $("pwerr"); x.textContent = ""; try { await BB.api.changePassword({ oldPassword: $("pw0").value, newPassword: $("pw1").value }); $("pw0").value = $("pw1").value = ""; U.toast("Password updated."); } catch (e) { x.textContent = e.message; } },
    async savelimits() { const x = $("limerr"); x.textContent = ""; try { S.w = await BB.api.setLimits({ deposit: val("ldep"), loss: val("lloss") }); U.toast("Limits saved."); } catch (e) { x.textContent = e.message; } },
    async cool(el) { S.w = await BB.api.coolOff(Number(el.dataset.m)); U.toast("Cool-off started."); renderPage(); },
    async endcool() { S.w = await BB.api.endCoolOff(); renderPage(); },
    exclude(el) { S.pex = el.dataset.d; U.openModal(`<h3>Self-exclude for ${S.pex} days?</h3><p>You won't be able to bet or deposit until it ends, and it can't be reversed early.</p><div class="actions"><button class="btn" data-act="confirmex">Yes, exclude me</button><button class="btn ghost" data-act="mclose">Cancel</button></div>`); },
    async confirmex() { S.w = await BB.api.selfExclude(Number(S.pex)); U.closeModal(); U.toast("Self-exclusion is active."); renderPage(); },
    async logout() { await BB.api.logout(); S.user = null; S.w = null; S.bets = []; S.sel = []; clearInterval(rcTimer); location.hash = "#/home"; render(); },
    authtab(el) { S.authTab = el.dataset.t; render(); }, forgot(el, ev) { ev.preventDefault(); U.toast("Password reset emails will work once the backend is connected."); },
    async authgo() {
      const x = $("autherr"); x.textContent = "";
      try { const v = S.authTab === "up" ? await BB.api.register({ name: val("a_name"), email: val("a_email"), password: $("a_pw").value, over18: $("a_age").checked }) : await BB.api.login({ email: val("a_email"), password: $("a_pw").value });
        await start(v); } catch (e) { x.textContent = e.message; }
    }
  };
  document.addEventListener("click", ev => {
    const el = ev.target.closest("[data-act]"); if (!el || el.disabled) return; const f = A[el.dataset.act]; if (f) f(el, ev);
  });
  document.addEventListener("input", ev => {
    const t = ev.target;
    if (t.dataset.stk) { S.stakes[t.dataset.stk] = t.value; U.slipUpdateTotals(); } if (t.id === "pstake") { S.pstake = t.value; U.slipUpdateTotals(); }
  });
  document.addEventListener("change", ev => {
    const t = ev.target; if (t.id === "compsel") { S.comp = t.value; renderPage(); } if (t.id === "rc") { S.reality = Number(t.value); startReality(); U.toast(S.reality ? "Reminder set." : "Reminder off."); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") U.closeModal(); if (e.key === "Enter" && !U.modalOpen() && (e.target.id === "a_pw" || e.target.id === "a_email")) A.authgo(); });

  /* ---------- start ---------- */
  async function start(v) {
    S.user = v.user; S.w = v; S.bets = await BB.api.bets(); $("foot").innerHTML = "18+ only. Gambling can be addictive; play responsibly. " + (C.PAYMENTS_ENABLED ? "Payments are processed securely through the connected provider." : "Payments are currently unavailable.") + " Fixtures and results: TheSportsDB. Odds marked “Indicative” are estimates, not bookmaker prices.";
    parseRoute(); render(); startReality();
  }
  async function boot() {
    parseRoute();
    SP().load().then(() => { syncSlipOdds(); if (S.user && !U.modalOpen() && document.activeElement.id !== "search") render(); });
    let me = null; try { me = await BB.api.me(); } catch (e) {}
    if (me) await start(me); else render();
  }
  setInterval(() => { if (!S.user) return; SP().load().then(() => { syncSlipOdds(); if (!U.modalOpen() && document.activeElement.id !== "search") render(); }); }, 5 * 6e4);
  setInterval(() => { if (S.user && C.TSDB_V2_KEY) SP().loadLive().then(() => { if (!U.modalOpen() && document.activeElement.id !== "search") renderPage(); }); }, 6e4);
  setInterval(() => { if (S.user) checkResults(false); }, 9e4);
  setInterval(() => { if (S.user && !U.modalOpen() && ["home", "sports", "live"].includes(S.route) && document.activeElement.id !== "search") { renderPage(); U.renderSlip(); } }, 3e4);
  setInterval(async () => { if (S.user && S.route === "wallet" && S.wtab === "history" && !U.modalOpen()) refreshWallet(); }, 4000);
  BB.boot = boot;
})(window.BB);
