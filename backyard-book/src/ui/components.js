/* Reusable UI pieces: helpers, toast/modal, header, bottom nav, match card, odds button, bet slip. */
(function (BB) {
  const C = BB.config;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = n => C.CURRENCY + " " + num(n);
  const timeFmt = ms => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function dayLabel(ms) {
    const d = new Date(ms), t = new Date(), tm = new Date(t.getTime() + 864e5), k = x => x.toDateString();
    return k(d) === k(t) ? "Today" : k(d) === k(tm) ? "Tomorrow" : d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  }
  function startsIn(ms) { const m = Math.round((ms - Date.now()) / 6e4); if (m <= 0) return ""; if (m < 60) return "Starts in " + m + " min"; if (m < 1440) return "Starts in " + Math.floor(m / 60) + "h " + (m % 60) + "m"; return ""; }
  function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800); }
  function openModal(h) { $("modal").innerHTML = `<div class="ov" data-act="ovclose"><div class="modal" role="dialog" aria-modal="true">${h}</div></div>`; }
  function closeModal() { $("modal").innerHTML = ""; }
  const modalOpen = () => !!$("modal").innerHTML;

  const initials = n => n.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const logoImg = (u, n) => u ? `<img src="${esc(u)}/tiny" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;ph&quot;>${esc(initials(n))}</div>'">` : `<div class="ph">${esc(initials(n))}</div>`;

  /* ---- odds ---- */
  const KEYS = e => e.draw ? ["H", "D", "A"] : ["H", "A"];
  const KLABEL = { H: "1", D: "X", A: "2" };
  function oddBtn(e, k) {
    const on = BB.S.sel.some(s => s.e === e.id && s.k === k), mv = e.mv && e.mv[k];
    return `<button class="odd ${mv > 0 ? "up" : mv < 0 ? "down" : ""}" data-act="odd" data-e="${esc(e.id)}" data-k="${k}" aria-pressed="${on}" aria-label="${esc(e.title)}: ${k === "H" ? e.home : k === "A" ? e.away : "Draw"} at ${e.odds[k].toFixed(2)}"><small>${KLABEL[k]}</small><b>${e.odds[k].toFixed(2)}</b></button>`;
  }
  function oddsRow(e) { const ks = KEYS(e); return `<div class="odds" style="--n:${ks.length}">${ks.map(k => oddBtn(e, k)).join("")}</div>`; }

  /* ---- match card ---- */
  function matchCard(e) {
    const ph = BB.sports.phase(e), score = e.hs !== null && e.as !== null, fav = BB.S.favs.has(e.id);
    const head = ph === "live" ? `<span class="live-tag">LIVE ${esc(e.progress || "")}</span>` : ph === "ft" ? "Full time" : ph === "void" ? "Postponed" : esc(dayLabel(e.start));
    const mid = ph === "live" || ph === "ft" ? (score ? `<b class="score">${e.hs} - ${e.as}</b>` : `<b>vs</b>`) + `<small>${ph === "live" ? "In play" : "Final"}</small>`
      : `<b>${timeFmt(e.start)}</b><small>${esc(startsIn(e.start) || dayLabel(e.start))}</small>`;
    const foot = ph === "up" ? `<div class="ft"><span class="tag ${e.src === "feed" ? "feed" : ""}">${e.src === "feed" ? "Bookmaker odds" : "Indicative odds"}</span><span>Match winner</span></div>` : "";
    const bottom = ph === "up" ? oddsRow(e) : `<div class="susp">${ph === "live" ? "Betting closed once play starts" : ph === "void" ? "Match postponed. Bets are refunded." : "Betting closed"}</div>`;
    return `<article class="mc ${ph === "live" ? "live" : ""}"><div class="hd"><span class="lgn">${BB.sports.icon(e.sport)} ${esc(e.league)}</span><span>${head}<button class="fav ${fav ? "on" : ""}" data-act="fav" data-e="${esc(e.id)}" aria-label="Favourite" aria-pressed="${fav}">${fav ? "★" : "☆"}</button></span></div>
    <div class="body" data-act="match" data-e="${esc(e.id)}"><div class="tm">${logoImg(e.hb, e.home)}<span>${esc(e.home)}</span></div><div class="mid">${mid}</div><div class="tm">${logoImg(e.ab, e.away)}<span>${esc(e.away)}</span></div></div>
    ${bottom}${foot}</article>`;
  }

  /* ---- header + nav ---- */
  const ROUTES = [["home", "Home", "🏠"], ["sports", "Sports", "⚽"], ["live", "Live", "🔴"], ["bets", "Bets", "🎟"], ["wallet", "Wallet", "👛"]];
  function header() {
    const S = BB.S, r = S.route;
    const link = (id, t) => `<a href="#/${id}" class="${r === id ? "on" : ""}">${t}</a>`;
    return `<div class="wrapx"><a class="logo" href="#/home"><i>🎯</i>Backyard<b>Book</b></a>
    <nav class="dnav" aria-label="Main">${link("sports", "Sports")}${link("live", "Live")}${link("promotions", "Promotions")}${link("bets", "My Bets")}${link("wallet", "Wallet")}</nav>
    <div class="hr">
    <a class="balpill" id="balpill" href="#/wallet"><small>Balance</small>${money(S.w ? S.w.cash + S.w.bonus : 0)}</a>
    <a class="cta hdep" href="#/wallet" data-act="goDeposit">Deposit</a>
    <a class="avatar" href="#/account" aria-label="Account">${esc(S.user ? S.user.name[0].toUpperCase() : "?")}</a></div></div>`;
  }
  function bottomNav() {
    const S = BB.S, open = S.bets.filter(b => b.status === "open").length;
    return ROUTES.map(([id, t, ic]) => `<a href="#/${id}" class="${S.route === id ? "on" : ""}"><span>${ic}</span>${t}${id === "bets" && open ? `<i>${open}</i>` : ""}</a>`).join("");
  }

  /* ---- bet slip ---- */
  const px = s => BB.sports.EV[s.e].odds[s.k];
  const pick = s => { const e = BB.sports.EV[s.e]; return s.k === "H" ? e.home : s.k === "A" ? e.away : "Draw"; };
  const stakeOf = id => Math.max(0, Math.round((Number(BB.S.stakes[id]) || 0) * 100) / 100);
  function slipCalc() {
    const S = BB.S;
    if (S.mode === "acc") { const o = Math.round(S.sel.reduce((a, s) => a * (s.odds || px(s)), 1) * 100) / 100, st = Math.max(0, Math.round((Number(S.pstake) || 0) * 100) / 100); return { stake: st, ret: S.sel.length > 1 ? st * o : 0, odds: o }; }
    let st = 0, ret = 0; S.sel.forEach(s => { const x = stakeOf(s.e); st += x; ret += x * (s.odds || px(s)); }); return { stake: st, ret, odds: 0 };
  }
  function legState(s) { const e = BB.sports.EV[s.e]; if (!e || BB.sports.phase(e) !== "up") return "dead"; return s.newOdds && s.newOdds !== s.odds ? "changed" : "ok"; }
  function slipHTML() {
    const S = BB.S, n = S.sel.length, c = slipCalc();
    const legs = n ? S.sel.map(s => {
      const e = BB.sports.EV[s.e], st = legState(s);
      return `<div class="leg"><div class="p">${esc(pick(s))}</div><button class="x" data-act="rm" data-e="${esc(s.e)}" aria-label="Remove">×</button>
      <div class="m">${esc(e.title)} · Match winner</div><div class="o">${(st === "changed" ? s.newOdds : s.odds).toFixed(2)}</div>
      ${st === "dead" ? `<div class="alert dead">This market is suspended. Remove it to continue.</div>` : ""}
      ${st === "changed" ? `<div class="alert warn">Odds changed ${s.odds.toFixed(2)} → ${s.newOdds.toFixed(2)}</div>` : ""}
      ${S.mode === "single" ? `<input type="number" inputmode="decimal" min="${C.MIN_STAKE}" placeholder="Stake (${C.CURRENCY})" aria-label="Stake for ${esc(pick(s))}" data-stk="${esc(s.e)}" value="${esc(S.stakes[s.e] || "")}">` : ""}</div>`;
    }).join("") : `<div class="empty" style="margin:6px 0"><b>Your slip is empty</b>Tap any odds to add a selection.</div>`;
    const changed = S.sel.some(s => legState(s) === "changed");
    return `<button class="slip-bar" data-act="slipToggle" aria-expanded="${S.slipOpen}">🎟 BET SLIP <span id="slipcnt">${n}</span></button>
    <div class="sp"><h3>Bet slip ${n ? `<button data-act="clear">Clear all</button>` : ""}</h3>
    <div class="seg"><button data-act="mode" data-m="single" aria-pressed="${S.mode === "single"}">Singles</button><button data-act="mode" data-m="acc" aria-pressed="${S.mode === "acc"}">Accumulator</button></div>
    ${legs}
    ${S.mode === "acc" && n ? `<div class="sumrow"><span class="mu">${n} selection${n > 1 ? "s" : ""} · combined odds</span><b>${c.odds.toFixed(2)}</b></div><input id="pstake" type="number" inputmode="decimal" min="${C.MIN_STAKE}" placeholder="Stake (${C.CURRENCY})" value="${esc(S.pstake)}" style="margin-top:8px">` : ""}
    ${n ? `<div class="presets">${[10, 20, 50, 100].map(v => `<button data-act="preset" data-v="${v}">+${v}</button>`).join("")}</div>` : ""}
    <div class="sumrow"><span class="mu">Total stake</span><b id="s_tot">${money(c.stake)}</b></div>
    <div class="sumrow"><span class="mu">Potential profit</span><b id="s_prof">${money(Math.max(0, c.ret - c.stake))}</b></div>
    <div class="sumrow big"><span>Potential return</span><b id="s_ret">${money(c.ret)}</b></div>
    <div class="err" id="s_err" role="alert"></div>
    ${changed ? `<button class="btn gold block" data-act="accept">Accept odds changes</button>` : `<button class="btn block" id="s_place" data-act="place" disabled>Place bet</button>`}
    <p class="mu" style="font-size:11px;margin-top:8px;text-align:center">Min stake ${money(C.MIN_STAKE)} · Max ${money(C.MAX_STAKE)}</p></div>`;
  }
  function slipValidate() {
    const S = BB.S, c = slipCalc(), w = S.w; let m = "", ok = true;
    if (!S.sel.length) ok = false;
    else if (S.sel.some(s => legState(s) === "dead")) { m = "Remove suspended selections to continue."; ok = false; }
    else if (S.mode === "acc" && S.sel.length < 2) { m = "An accumulator needs at least 2 selections."; ok = false; }
    else if (c.stake <= 0) ok = false;
    else if (S.mode === "single" && S.sel.some(s => stakeOf(s.e) < C.MIN_STAKE)) { m = "Enter a stake of " + money(C.MIN_STAKE) + " or more on each selection."; ok = false; }
    else if (S.mode === "acc" && c.stake < C.MIN_STAKE) { m = "Minimum stake is " + money(C.MIN_STAKE) + "."; ok = false; }
    else if ((S.mode === "single" ? S.sel.some(s => stakeOf(s.e) > C.MAX_STAKE) : c.stake > C.MAX_STAKE)) { m = "Maximum stake is " + money(C.MAX_STAKE) + "."; ok = false; }
    else if (w && c.stake > w.cash + w.bonus) { m = "Insufficient balance. Deposit to continue."; ok = false; }
    return { ok, m, c };
  }
  function slipUpdateTotals() {
    const v = slipValidate(); if (!$("s_tot")) return;
    $("s_tot").textContent = money(v.c.stake); $("s_prof").textContent = money(Math.max(0, v.c.ret - v.c.stake)); $("s_ret").textContent = money(v.c.ret);
    $("s_err").textContent = v.m; const b = $("s_place"); if (b) { b.disabled = !v.ok; b.textContent = BB.S.mode === "acc" ? "Place accumulator" : BB.S.sel.length > 1 ? "Place bets" : "Place bet"; }
  }
  function renderSlip() {
    const S = BB.S, el = $("slip"), show = ["home", "sports", "live", "match"].includes(S.route);
    el.hidden = !show || (!S.sel.length && innerWidth < 900);
    el.classList.toggle("open", S.slipOpen); el.innerHTML = slipHTML(); slipUpdateTotals();
    $("page-shell").classList.toggle("two", show);
  }

  BB.ui = { $, esc, num, money, timeFmt, dayLabel, startsIn, toast, openModal, closeModal, modalOpen, logoImg, oddsRow, matchCard, header, bottomNav,
    renderSlip, slipValidate, slipUpdateTotals, slipCalc, px, pick, stakeOf, legState };
})(window.BB);
