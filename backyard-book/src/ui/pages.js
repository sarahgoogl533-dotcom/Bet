/* Page templates. Each returns an HTML string; main.js wires up events. */
(function (BB) {
  const C = BB.config, U = BB.ui, esc = U.esc, money = U.money;
  const sp = () => BB.sports;
  const skel = n => Array.from({ length: n }, () => '<div class="sk"></div>').join("");
  const empty = (t, s) => `<div class="empty"><b>${t}</b>${s || ""}</div>`;
  const sec = (t, link) => `<div class="sec"><h2>${t}</h2>${link || ""}</div>`;
  const cards = l => l.map(U.matchCard).join("");

  function feedStatus() {
    const st = sp().state;
    if (st.loading) return `<div class="status">Updating fixtures…</div>`;
    if (st.sample) return `<div class="notice err"><b>Couldn't reach the live fixtures feed${st.error ? " (" + esc(st.error) + ")" : ""}.</b> Showing sample fixtures so you can still test. <button data-act="refresh" style="text-decoration:underline;font-weight:700">Retry</button></div>`;
    return `<div class="status"><span>Fixtures updated ${st.at ? U.timeFmt(st.at) : "-"}</span><span>Odds: ${esc(st.odds)}</span><button data-act="refresh">Refresh</button></div>`;
  }
  function filtered(list, S) {
    return list.filter(e => (S.sport === "All" || e.sport === S.sport) && (S.comp === "All" || e.league === S.comp) && (!S.favOnly || S.favs.has(e.id)) && (!S.q || (e.title + e.league).toLowerCase().includes(S.q.toLowerCase())));
  }
  function filters(S, all) {
    const sports = ["All", ...new Set(all.map(e => e.sport))];
    const comps = ["All", ...[...new Set(all.filter(e => S.sport === "All" || e.sport === S.sport).map(e => e.league))].sort((a, b) => sp().leagueRank(a) - sp().leagueRank(b))];
    return `<div class="tools"><input id="search" type="search" placeholder="Search teams or competitions" value="${esc(S.q)}" aria-label="Search"><select id="compsel" aria-label="Competition">${comps.map(c => `<option ${c === S.comp ? "selected" : ""} value="${esc(c)}">${c === "All" ? "All competitions" : esc(c)}</option>`).join("")}</select></div>
    <div class="chips">${sports.map(s => `<button class="chip" data-act="sport" data-s="${esc(s)}" aria-pressed="${S.sport === s}">${s === "All" ? "All sports" : sp().icon(s) + " " + esc(sp().label(s))}</button>`).join("")}<button class="chip" data-act="favonly" aria-pressed="${S.favOnly}">★ Favourites</button></div>`;
  }

  const pages = {
    /* ---------- HOME ---------- */
    home(S) {
      const all = sp().list(), up = all.filter(e => sp().phase(e) === "up").sort((a, b) => a.start - b.start), live = all.filter(e => sp().phase(e) === "live");
      if (!all.length) return sp().state.loading ? `<div class="sk" style="height:260px"></div><div class="sec"><h2>Loading fixtures</h2></div><div class="grid c2">${skel(4)}</div>` : feedStatus() + empty("No fixtures right now", "Check back soon.");
      const feat = live[0] || [...up].sort((a, b) => sp().leagueRank(a.league) - sp().leagueRank(b.league) || a.start - b.start)[0];
      const soon = up.filter(e => e.start - Date.now() < 6 * 3600e3).slice(0, 8), soonL = soon.length ? soon : up.slice(0, 6);
      const today = up.filter(e => new Date(e.start).toDateString() === new Date().toDateString()).sort((a, b) => sp().leagueRank(a.league) - sp().leagueRank(b.league)).slice(0, 8);
      const popular = today.length ? today : [...up].sort((a, b) => sp().leagueRank(a.league) - sp().leagueRank(b.league)).slice(0, 6);
      const sports = ["Soccer", "Basketball", "Ice Hockey", "Baseball", "American Football"];
      return `${feedStatus()}${feat ? hero(feat) : ""}
      <div class="sec"><h2>Sports</h2></div><div class="short">${sports.map(s => `<a href="#/sports" data-act="goSport" data-s="${s}"><span>${sp().icon(s)}</span>${esc(sp().label(s))}</a>`).join("")}</div>
      ${live.length ? sec("🔴 Live now", '<a href="#/live">See all</a>') + `<div class="rail">${cards(live)}</div>` : ""}
      ${sec("⚡ Starting soon", '<a href="#/sports">All fixtures</a>')}<div class="rail">${cards(soonL)}</div>
      ${sec("🔥 Popular today")}<div class="grid c2">${cards(popular.slice(0, 6))}</div>
      ${sec("🏆 Top competitions")}<div class="chips">${sp().LEAGUES.map(l => `<a class="chip" href="#/sports" data-act="goComp" data-c="${esc(l.n)}">${sp().icon(l.sp)} ${esc(l.n)}</a>`).join("")}</div>
      <div class="promo" style="margin-top:18px"><h2>WELCOME OFFER</h2><div class="big">100% up to ${money(C.WELCOME.max)}</div><a class="btn gold" href="#/promotions">View offer</a></div>`;
    },
    /* ---------- SPORTS ---------- */
    sports(S) {
      const all = sp().list().filter(e => sp().phase(e) === "up").sort((a, b) => a.start - b.start), list = filtered(all, S);
      let html = "", last = ""; list.forEach(e => { const d = U.dayLabel(e.start); if (d !== last) { html += `<div class="sec" style="margin:18px 0 10px"><h2 style="font-size:15px;color:var(--mu)">${esc(d)}</h2></div>`; last = d; } html += U.matchCard(e); });
      const loading = sp().state.loading && !all.length;
      return `<div class="sec"><h2>Sports</h2></div>${feedStatus()}${filters(S, all)}<div class="grid c2" style="grid-template-columns:1fr">${loading ? skel(4) : html || empty("No fixtures match", "Try another sport or clear the search.")}</div>`;
    },
    /* ---------- LIVE ---------- */
    live(S) {
      const all = sp().list().filter(e => { const p = sp().phase(e); return p === "live" || (p === "ft" && Date.now() - e.start < 14 * 3600e3); });
      const list = filtered(all, S).sort((a, b) => (sp().phase(a) === "live" ? 0 : 1) - (sp().phase(b) === "live" ? 0 : 1) || b.start - a.start);
      const hasKey = !!C.TSDB_V2_KEY;
      return `<div class="sec"><h2>🔴 Live</h2></div>${feedStatus()}${hasKey ? "" : `<div class="notice">Live scores and minute-by-minute updates need a live-scores feed key. Add one in <code>config.js</code> (TSDB_V2_KEY). Until then matches are marked live from kick-off time.</div>`}${filters(S, all)}
      <div class="grid c2">${list.length ? cards(list) : empty("Nothing in play right now", "Upcoming matches are in <a href='#/sports' style='color:var(--gold)'>Sports</a>.")}</div>`;
    },
    /* ---------- MATCH ---------- */
    match(S) {
      const e = sp().EV[S.param]; if (!e) return `<a class="back" href="#/sports">‹ Back</a>${empty("Match not found", "It may have finished or been removed.")}`;
      const ph = sp().phase(e), score = e.hs !== null && e.as !== null;
      return `<a class="back" href="javascript:history.back()">‹ Back</a><section class="hero" data-icon="${sp().icon(e.sport)}"><div class="lg">${sp().icon(e.sport)} ${esc(e.league)} · ${ph === "live" ? '<span class="live-tag">LIVE</span>' : ph === "ft" ? "Full time" : esc(U.dayLabel(e.start))}</div>
      <div class="vs"><div class="tm">${U.logoImg(e.hb, e.home)}${esc(e.home)}</div><div class="mid"><b>${score ? e.hs + " - " + e.as : U.timeFmt(e.start)}</b><small>${ph === "up" ? esc(U.startsIn(e.start)) : ""}</small></div><div class="tm">${U.logoImg(e.ab, e.away)}${esc(e.away)}</div></div></section>
      <div class="sec"><h2>Match winner</h2></div>${ph === "up" ? U.oddsRow(e) + `<p class="mu" style="font-size:12px;margin-top:10px">${e.src === "feed" ? "Prices from bookmaker feed." : "Indicative prices: connect an odds feed for live bookmaker prices."}</p>` : `<div class="susp">Betting is closed for this match.</div>`}
      <div class="card" style="margin-top:18px"><h3>Match info</h3><div class="kv2"><span class="mu">Competition</span><b>${esc(e.league)}</b></div><div class="kv2"><span class="mu">Kick-off</span><b>${new Date(e.start).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b></div><div class="kv2"><span class="mu">Markets</span><b>Match winner</b></div></div>`;
    },
    /* ---------- MY BETS ---------- */
    bets(S) {
      const tabs = [["open", "Open"], ["settled", "Settled"], ["void", "Void"]], f = { open: b => b.status === "open", settled: b => b.status === "won" || b.status === "lost", void: b => b.status === "void" };
      const list = S.bets.filter(f[S.betTab]);
      const card = b => {
        const R = BB.sports.RES;
        return `<div class="bet ${b.status}"><div class="t"><span>${b.type === "acc" ? "Accumulator · " + b.legs.length + " selections" : "Single"}</span><span class="st ${b.status}">${b.status.toUpperCase()}</span></div>
        <ul>${b.legs.map(l => { const r = R[l.eventId]; return `<li>${esc(l.pick)} <b>@ ${l.odds.toFixed(2)}</b><br><small>${esc(l.title)}${r === undefined ? " · awaiting result" : r === "V" ? " · void" : r === l.key ? " · ✓ won" : " · ✗ lost"}</small></li>`; }).join("")}</ul>
        <div class="kv"><span>Bet ID</span><b>${esc(b.id)}</b></div><div class="kv"><span>Stake</span><b>${money(b.stake)}</b></div><div class="kv"><span>Odds</span><b>${b.odds.toFixed(2)}</b></div>
        <div class="kv"><span>${b.status === "open" ? "Potential return" : b.status === "won" ? "Paid" : b.status === "void" ? "Refunded" : "Return"}</span><b class="${b.status === "won" ? "ok" : ""}">${money(b.status === "open" ? b.stake * b.odds : b.status === "lost" ? 0 : b.paid)}</b></div></div>`;
      };
      return `<div class="sec"><h2>My bets</h2><button class="btn sm alt" data-act="checkResults">Check results</button></div>
      <div class="seg" style="grid-template-columns:repeat(3,1fr)">${tabs.map(([k, t]) => `<button data-act="betTab" data-t="${k}" aria-pressed="${S.betTab === k}">${t}${k === "open" && S.bets.filter(f.open).length ? " (" + S.bets.filter(f.open).length + ")" : ""}</button>`).join("")}</div>
      <p class="mu" style="font-size:12px;margin-bottom:12px">Bets settle automatically from official results once matches finish.</p>
      ${list.length ? list.map(card).join("") : empty("No " + S.betTab + " bets", S.betTab === "open" ? "Pick some odds and place a bet." : "")}`;
    },
    /* ---------- WALLET ---------- */
    wallet(S) {
      const w = S.w;
      const tabs = [["deposit", "Deposit"], ["withdraw", "Withdraw"], ["history", "History"]];
      const pct = w.bonusReq ? Math.min(100, w.bonusWag / w.bonusReq * 100) : 0;
      const paymentNote = C.PAYMENTS_ENABLED ? "" : `<div class="lockcard"><b>Payments are currently unavailable.</b> You can set up your account and explore the wallet, but deposits and withdrawals will remain unavailable until the secure payment service is connected.</div>`;
      const meth = (k, items) => `<div class="methods">${items.map(([id, ic, t]) => `<button class="method" data-act="${k}" data-v="${id}" aria-pressed="${S[k === "dm" ? "dm" : "wm"] === id}"><span>${ic}</span>${t}</button>`).join("")}</div>`;
      let body = "";
      if (S.wtab === "deposit") {
        const offer = w.promoOptIn && !w.promoClaimed ? `<div class="notice">Welcome offer active: deposit ${money(C.WELCOME.minDep)} or more to get a ${C.WELCOME.pct}% bonus (up to ${money(C.WELCOME.max)}).</div>` : "";
        body = `<div class="card"><h3>Deposit</h3>${paymentNote}${offer}<label class="l">Payment method</label>${meth("dm", [["momo", "📱", "Mobile Money"], ["card", "💳", "Card"], ["bank", "🏦", "Bank"]])}
        ${S.dm === "momo" ? `<label class="l" for="dnet">Network</label><select id="dnet"><option>MTN MoMo</option><option>Vodafone Cash</option><option>AirtelTigo Money</option></select><label class="l" for="dphone">Mobile number</label><input id="dphone" type="tel" inputmode="tel" placeholder="024 000 0000">`
          : `<p class="mu" style="font-size:13px;margin-top:12px">You'll finish this payment on ${esc(C.PAYMENT_PROVIDER)}'s secure checkout. Card and bank details are never entered on this site.</p>`}
        <label class="l" for="dAmt">Amount (${C.CURRENCY})</label><input id="dAmt" type="number" inputmode="decimal" placeholder="100.00">
        <div class="presets">${[20, 50, 100, 200].map(v => `<button data-act="dpreset" data-v="${v}">${v}</button>`).join("")}</div>
        <div class="err" id="derr" role="alert"></div><button class="btn block" data-act="deposit">Continue</button>
        <p class="mu" style="font-size:12px;margin-top:10px">Daily deposit limit: ${w.limits.deposit == null ? "none" : money(w.limits.deposit)} · deposited in the last 24h: ${money(w.depositedToday)}</p></div>`;
      } else if (S.wtab === "withdraw") {
        body = `<div class="card"><h3>Withdraw</h3>${paymentNote}<p class="mu" style="font-size:13px">Withdrawable cash: <b style="color:var(--tx)">${money(w.cash)}</b>${w.bonus ? ` · bonus ${money(w.bonus)} is locked until wagering is complete` : ""}</p>
        ${w.kyc ? "" : `<div class="notice">Identity verification is required before your first withdrawal. <button data-act="kyc" style="text-decoration:underline;font-weight:700">Verify now</button></div>`}
        <label class="l">Withdraw to</label>${meth("wm", [["momo", "📱", "Mobile Money"], ["bank", "🏦", "Bank"]])}
        <label class="l" for="wAmt">Amount (${C.CURRENCY})</label><input id="wAmt" type="number" inputmode="decimal" placeholder="${C.MIN_WD}.00">
        <label class="l" for="wDest">${S.wm === "momo" ? "Mobile Money number" : "Bank account number"}</label><input id="wDest" inputmode="numeric" placeholder="${S.wm === "momo" ? "024 000 0000" : "Account number"}">
        <div class="err" id="werr" role="alert"></div><button class="btn block" data-act="withdraw">Withdraw</button>
        <p class="mu" style="font-size:12px;margin-top:10px">Minimum ${money(C.MIN_WD)}. You can cancel a withdrawal while it is still Pending.</p></div>`;
      } else {
        const groups = { All: null, Deposits: ["Deposit", "Bonus", "Bonus released"], Withdrawals: ["Withdrawal", "Withdrawal reversal"], Bets: ["Bet", "Winning bet", "Bet refund"] };
        const rows = w.ledger.filter(t => !groups[S.txf] || groups[S.txf].includes(t.type));
        body = `<div class="card"><h3>Transactions</h3><div class="chips">${Object.keys(groups).map(k => `<button class="chip" data-act="txf" data-v="${k}" aria-pressed="${S.txf === k}">${k}</button>`).join("")}</div>
        ${rows.map(t => `<div class="tx"><div><b>${esc(t.type)}</b> <span class="st ${t.status}">${t.status}</span><br><small>${new Date(t.ts).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${esc(t.ref)}${t.note ? " · " + esc(t.note) : ""}</small></div>
        <div class="a ${t.amount >= 0 ? "ok" : ""}">${t.amount >= 0 ? "+" : ""}${U.num(t.amount)}<br><small class="mu">bal ${U.num(t.after)}</small></div>${t.type === "Withdrawal" && t.status === "pending" ? `<div><button class="btn sm ghost" data-act="cancelwd" data-id="${esc(t.id)}">Cancel withdrawal</button></div>` : ""}</div>`).join("") || empty("No transactions yet")}</div>`;
      }
      return `<div class="walletcard"><small>Available balance</small><div class="amt" id="walletamt">${money(w.cash)}</div>
      <div class="sub"><div><small>Bonus balance</small><b>${money(w.bonus)}</b></div><div><small>Total</small><b>${money(w.cash + w.bonus)}</b></div></div>
      <div class="row"><button class="btn" data-act="wt" data-v="deposit">+ Deposit</button><button class="btn alt" data-act="wt" data-v="withdraw">Withdraw</button></div></div>
      ${w.bonusReq ? `<div class="card"><b>Bonus wagering</b><div class="bar"><i style="width:${pct}%"></i></div><small class="mu">${money(w.bonusWag)} of ${money(w.bonusReq)} wagered. Your bonus becomes cash when complete.</small></div>` : ""}
      <div class="seg" style="grid-template-columns:repeat(3,1fr)">${tabs.map(([k, t]) => `<button data-act="wt" data-v="${k}" aria-pressed="${S.wtab === k}">${t}</button>`).join("")}</div>${body}`;
    },
    /* ---------- PROMOTIONS ---------- */
    promotions(S) {
      const w = S.w, W = C.WELCOME, state = w.promoClaimed ? "claimed" : w.promoOptIn ? "active" : "open";
      return `<div class="sec"><h2>Promotions</h2></div>
      <div class="promo"><h2>WELCOME OFFER</h2><div class="big">GET ${W.pct}% UP TO ${money(W.max)}</div><p class="mu" style="margin-bottom:14px;font-size:14px">Make your first deposit of ${money(W.minDep)} or more.</p>
      <button class="btn gold" data-act="claim" ${state !== "open" ? "disabled" : ""}>${state === "claimed" ? "Offer claimed ✓" : state === "active" ? "Offer active: make a deposit" : "Claim offer"}</button></div>
      <div class="card"><h3>Terms</h3><div class="kv2"><span class="mu">Eligibility</span><b>New players, first deposit</b></div><div class="kv2"><span class="mu">Minimum deposit</span><b>${money(W.minDep)}</b></div><div class="kv2"><span class="mu">Maximum bonus</span><b>${money(W.max)}</b></div><div class="kv2"><span class="mu">Wagering</span><b>${W.wager}x the bonus</b></div><div class="kv2"><span class="mu">Withdrawals</span><b>Bonus funds are locked until wagering is met</b></div>
      <p class="mu" style="font-size:12px;margin-top:10px">18+. Please gamble responsibly. You can set limits or take a break any time in Account.</p></div>
      ${["Accumulator boost", "Weekend promotions", "Cashback", "Free bets"].map(t => `<div class="promo soon"><h2 style="color:var(--mu)">COMING SOON</h2><div style="font-size:20px;font-weight:800">${t}</div></div>`).join("")}`;
    },
    /* ---------- ACCOUNT ---------- */
    account(S) {
      const w = S.w, now = Date.now(), lim = w.limits;
      return `<div class="sec"><h2>Account</h2></div>
      <div class="card"><h3>Profile</h3><div class="kv2"><span class="mu">Name</span><b>${esc(w.user.name)}</b></div><div class="kv2"><span class="mu">Email</span><b>${esc(w.user.email)}</b></div><div class="kv2"><span class="mu">Player ID</span><b>${esc(w.user.id)}</b></div></div>
      <div class="card"><h3>Verification</h3><div class="kv2"><span class="mu">Identity</span><b class="${w.kyc ? "ok" : "gold"}">${w.kyc ? "Verified" : "Not verified"}</b></div>${w.kyc ? "" : `<button class="btn alt block" data-act="kyc" style="margin-top:10px">Verify identity</button>`}</div>
      <div class="card"><h3>Security</h3><label class="l" for="pw0">Current password</label><input id="pw0" type="password" autocomplete="current-password"><label class="l" for="pw1">New password</label><input id="pw1" type="password" autocomplete="new-password" placeholder="At least 8 characters"><div class="err" id="pwerr" role="alert"></div><button class="btn alt block" data-act="changepw">Change password</button></div>
      <div class="card"><h3>Betting limits</h3><label class="l" for="ldep">Daily deposit limit (${C.CURRENCY})</label><input id="ldep" type="number" inputmode="decimal" value="${lim.deposit == null ? "" : lim.deposit}" placeholder="No limit">
      <label class="l" for="lloss">Daily loss limit (${C.CURRENCY})</label><input id="lloss" type="number" inputmode="decimal" value="${lim.loss == null ? "" : lim.loss}" placeholder="No limit"><div class="err" id="limerr" role="alert"></div><button class="btn alt block" data-act="savelimits">Save limits</button></div>
      <div class="card"><h3>Responsible gambling</h3>
      ${w.excludeUntil > now ? `<div class="notice err">Self-excluded until ${w.excludeUntil > now + 3650 * 864e5 ? "further notice" : new Date(w.excludeUntil).toLocaleDateString()}.</div>` : ""}
      ${w.coolUntil > now ? `<div class="notice">Cool-off active until ${U.timeFmt(w.coolUntil)}. <button data-act="endcool" style="text-decoration:underline;font-weight:700">End early</button></div>` : ""}
      <label class="l">Take a break</label><div class="presets" style="grid-template-columns:repeat(3,1fr)"><button data-act="cool" data-m="30">30 min</button><button data-act="cool" data-m="60">1 hour</button><button data-act="cool" data-m="1440">24 hours</button></div>
      <label class="l">Self-exclusion</label><div class="presets" style="grid-template-columns:repeat(3,1fr)"><button data-act="exclude" data-d="7">7 days</button><button data-act="exclude" data-d="30">30 days</button><button data-act="exclude" data-d="180">6 months</button></div>
      <label class="l" for="rc">Reality check reminder</label><select id="rc"><option value="0" ${S.reality === 0 ? "selected" : ""}>Off</option><option value="30" ${S.reality === 30 ? "selected" : ""}>Every 30 minutes</option><option value="60" ${S.reality === 60 ? "selected" : ""}>Every hour</option></select>
      <p class="mu" style="font-size:12px;margin-top:10px">If gambling stops being fun, help is available: US 1-800-GAMBLER · UK BeGambleAware.org · Ghana: contact the Gaming Commission or a local support service.</p></div>
      <div class="card"><button class="btn ghost block" data-act="logout">Log out</button></div>`;
    },
    /* ---------- AUTH ---------- */
    auth(S) {
      const up = S.authTab === "up";
      return `<div class="authwrap"><div class="authbox"><div class="logo"><i>🎯</i>Backyard<b>Book</b></div><p class="s">"Sign in to start betting."</p>
      <div class="seg"><button data-act="authtab" data-t="up" aria-pressed="${up}">Sign up</button><button data-act="authtab" data-t="in" aria-pressed="${!up}">Log in</button></div>
      ${up ? `<label class="l" for="a_name">Name</label><input id="a_name" autocomplete="name" placeholder="Your name">` : ""}
      <label class="l" for="a_email">Email</label><input id="a_email" type="email" autocomplete="email" placeholder="you@example.com">
      <label class="l" for="a_pw">Password</label><input id="a_pw" type="password" autocomplete="${up ? "new-password" : "current-password"}" placeholder="At least 8 characters">
      ${up ? `<label class="chk"><input type="checkbox" id="a_age"> I am 18 or older (or the legal age where I live) and accept the Terms and Privacy Policy.</label>` : `<p class="mu" style="font-size:13px;margin-top:10px"><a href="#" data-act="forgot" style="text-decoration:underline">Forgot password?</a></p>`}
      <div class="err" id="autherr" role="alert"></div><button class="btn block" data-act="authgo">${up ? "Create account" : "Log in"}</button></div></div>`;
    }
  };

  function hero(e) {
    const ph = sp().phase(e), score = e.hs !== null && e.as !== null;
    return `<section class="hero" data-icon="${sp().icon(e.sport)}"><div class="lg">${sp().icon(e.sport)} ${esc(e.league)} · ${ph === "live" ? '<span class="live-tag">LIVE</span>' : esc(U.dayLabel(e.start))}</div>
    <div class="vs"><div class="tm">${U.logoImg(e.hb, e.home)}${esc(e.home)}</div><div class="mid"><b>${score && ph === "live" ? e.hs + " - " + e.as : U.timeFmt(e.start)}</b><small>${ph === "live" ? "In play" : esc(U.startsIn(e.start) || "Featured match")}</small></div><div class="tm">${U.logoImg(e.ab, e.away)}${esc(e.away)}</div></div>
    ${ph === "up" ? U.oddsRow(e) : ""}<a class="btn block" href="#/match/${esc(e.id)}" style="margin-top:12px">View match</a></section>`;
  }
  BB.pages = pages;
})(window.BB);
