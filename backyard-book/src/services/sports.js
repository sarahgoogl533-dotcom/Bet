/* Sports data: fixtures, scores, odds, results.
   Source: TheSportsDB (fixtures/results), optional The Odds API (bookmaker odds).
   In production move these calls to the backend so keys stay private and results are verified server-side. */
(function (BB) {
  const C = BB.config;
  const TSDB = "https://www.thesportsdb.com/api/v1/json/" + C.TSDB_KEY;
  const LEAGUES = [
    { id: 4328, n: "Premier League", sp: "Soccer", ok: "soccer_epl" },
    { id: 4480, n: "Champions League", sp: "Soccer", ok: "soccer_uefa_champs_league" },
    { id: 4335, n: "La Liga", sp: "Soccer", ok: "soccer_spain_la_liga" },
    { id: 4331, n: "Bundesliga", sp: "Soccer", ok: "soccer_germany_bundesliga" },
    { id: 4332, n: "Serie A", sp: "Soccer", ok: "soccer_italy_serie_a" },
    { id: 4334, n: "Ligue 1", sp: "Soccer", ok: "soccer_france_ligue_one" },
    { id: 4387, n: "NBA", sp: "Basketball", ok: "basketball_nba" },
    { id: 4380, n: "NHL", sp: "Ice Hockey", ok: "icehockey_nhl" },
    { id: 4424, n: "MLB", sp: "Baseball", ok: "baseball_mlb" },
    { id: 4391, n: "NFL", sp: "American Football", ok: "americanfootball_nfl" }
  ];
  const DAY_SPORTS = ["Soccer", "Basketball", "Ice_Hockey", "Baseball", "American_Football"];
  const LABEL = { "Soccer": "Football", "Ice Hockey": "Hockey", "American Football": "American football" };
  const ICON = { "Soccer": "⚽", "Basketball": "🏀", "Ice Hockey": "🏒", "Baseball": "⚾", "American Football": "🏈" };
  const EV = {}, RES = {};
  const state = { ok: false, at: null, loading: false, sample: false, odds: "indicative", error: "" };

  async function getJSON(url, headers) {
    const c = new AbortController(), to = setTimeout(() => c.abort(), 12000);
    try { const r = await fetch(url, { headers, signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    catch (e) { throw new Error(e.name === "AbortError" ? "timed out" : e.message); }
    finally { clearTimeout(to); }
  }
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };
  function indicative(home, away, draw) {
    const h = (50 + hash(home) % 50) * 1.12, a = 50 + hash(away) % 50, pd = draw ? .26 : 0;
    const ph = (1 - pd) * h / (h + a), pa = (1 - pd) * a / (h + a), o = p => Math.max(1.05, Math.round(100 / (p * 1.07)) / 100);
    return draw ? { H: o(ph), D: o(pd), A: o(pa) } : { H: o(ph), A: o(pa) };
  }
  function parse(r) {
    if (!r || !r.idEvent || !r.strHomeTeam || !r.strAwayTeam) return null;
    let ts = r.strTimestamp || (r.dateEvent && r.strTime ? r.dateEvent + "T" + r.strTime : null); if (!ts) return null;
    if (!/Z|[+-]\d\d:?\d\d$/.test(ts)) ts += "Z";
    const start = Date.parse(ts); if (isNaN(start)) return null;
    const sc = v => (v === null || v === undefined || v === "") ? null : Number(v);
    return { id: String(r.idEvent), sport: r.strSport || "Soccer", league: r.strLeague || "", home: r.strHomeTeam, away: r.strAwayTeam, start,
      hs: sc(r.intHomeScore), as: sc(r.intAwayScore), status: r.strStatus || "", progress: "", hb: r.strHomeTeamBadge || "", ab: r.strAwayTeamBadge || "" };
  }
  function upsert(p) {
    if (!p) return; const old = EV[p.id], draw = p.sport === "Soccer", e = Object.assign({}, old || {}, p);
    if (old) ["hs", "as"].forEach(k => { if (p[k] === null && old[k] !== null) e[k] = old[k]; });
    if (!e.odds || e.src !== "feed") { e.odds = indicative(e.home, e.away, draw); e.src = "indicative"; }
    e.title = e.home + " vs " + e.away; e.draw = draw; e.mv = e.mv || {}; EV[e.id] = e;
  }
  const finished = e => /^(FT|AET|PEN|AP|Match Finished|Finished|Final|After|Full)/i.test(e.status) || (e.hs !== null && e.as !== null && Date.now() - e.start > 3.5 * 3600e3);
  const voided = e => /Postponed|Cancelled|Canceled|Abandoned|Suspended/i.test(e.status);
  const win = e => e.sport === "Soccer" ? 2.75 * 3600e3 : 4 * 3600e3;
  function phase(e) {
    if (voided(e)) return "void"; if (finished(e)) return "ft";
    const d = Date.now() - e.start; if (d >= 0 && d < win(e)) return "live"; if (d >= win(e)) return "ft"; return "up";
  }
  function sample() {
    state.sample = true; const t = Date.now(), H = 3600e3;
    [["Riverton Rovers", "Eastgate United", "Soccer", "Sample League", -1.2], ["Lakeside City", "Northfield Town", "Soccer", "Sample League", .6], ["Cedar Hawks", "Bay Breakers", "Basketball", "Sample Hoops", 5],
     ["Summit Kings", "Delta Dunkers", "Basketball", "Sample Hoops", 26], ["Polar Wolves", "Iron Peaks", "Ice Hockey", "Sample Frost", 29], ["Port Sailors", "Hillcrest Athletic", "Soccer", "Sample Cup", 50],
     ["Harbor Gulls", "Dustbowl Sluggers", "Baseball", "Sample Series", 7]]
      .forEach((x, i) => upsert({ id: "sample" + i, home: x[0], away: x[1], sport: x[2], league: x[3], start: t + x[4] * H, hs: x[4] < 0 ? 1 : null, as: x[4] < 0 ? 0 : null, status: "", progress: "", hb: "", ab: "" }));
  }
  async function loadOdds() {
    try {
      const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, ""); let n = 0;
      await Promise.allSettled([...new Set(LEAGUES.map(l => l.ok))].map(async k => {
        const games = await getJSON(`https://api.the-odds-api.com/v4/sports/${k}/odds/?regions=uk&markets=h2h&oddsFormat=decimal&apiKey=${encodeURIComponent(C.ODDS_API_KEY)}`);
        games.forEach(g => {
          const all = Object.values(EV);
          const e = all.find(x => norm(x.home) === norm(g.home_team) && norm(x.away) === norm(g.away_team)) || all.find(x => norm(x.home).includes(norm(g.home_team)) && norm(x.away).includes(norm(g.away_team)));
          const mk = g.bookmakers && g.bookmakers[0] && g.bookmakers[0].markets.find(m => m.key === "h2h"); if (!e || !mk) return;
          const o = {}; mk.outcomes.forEach(x => { const nm = norm(x.name); if (nm === norm(g.home_team)) o.H = x.price; else if (nm === norm(g.away_team)) o.A = x.price; else if (nm === "draw") o.D = x.price; });
          if (o.H && o.A && (!e.draw || o.D)) { ["H", "D", "A"].forEach(k2 => { if (e.odds[k2] && o[k2]) e.mv[k2] = o[k2] > e.odds[k2] ? 1 : o[k2] < e.odds[k2] ? -1 : 0; }); e.odds = o; e.src = "feed"; n++; }
        });
      }));
      state.odds = n ? "bookmaker feed (" + n + " matches)" : "indicative";
    } catch (e) { state.odds = "indicative"; }
  }
  async function loadLive() {
    try {
      const j = await getJSON("https://www.thesportsdb.com/api/v2/json/livescore/all", { "X-API-KEY": C.TSDB_V2_KEY });
      (j.livescore || j.events || []).forEach(r => { const e = EV[String(r.idEvent)]; if (!e) return;
        if (r.intHomeScore != null) e.hs = Number(r.intHomeScore); if (r.intAwayScore != null) e.as = Number(r.intAwayScore); e.status = r.strStatus || e.status; e.progress = r.strProgress || ""; });
    } catch (e) {}
  }
  async function load() {
    if (state.loading) return; state.loading = true; state.error = "";
    const day = new Date().toISOString().slice(0, 10), jobs = [];
    LEAGUES.forEach(l => jobs.push(getJSON(`${TSDB}/eventsnextleague.php?id=${l.id}`).then(j => (j.events || []).forEach(r => upsert(parse(r))))));
    DAY_SPORTS.forEach(s => jobs.push(getJSON(`${TSDB}/eventsday.php?d=${day}&s=${s}`).then(j => (j.events || []).forEach(r => upsert(parse(r))))));
    const r = await Promise.allSettled(jobs), ok = r.filter(x => x.status === "fulfilled").length, bad = r.find(x => x.status === "rejected");
    if (bad) state.error = bad.reason && bad.reason.message || "unknown error";
    if (ok === 0 && !Object.keys(EV).length) sample(); else if (ok > 0) { state.sample = false; Object.keys(EV).forEach(k => { if (k.startsWith("sample")) delete EV[k]; }); }
    state.ok = ok > 0; state.at = new Date(); state.loading = false;
    if (C.ODDS_API_KEY) await loadOdds(); if (C.TSDB_V2_KEY) await loadLive();
  }
  async function fetchResult(id) {
    const j = await getJSON(`${TSDB}/lookupevent.php?id=${id}`), p = parse(j.events && j.events[0]); if (!p) return null;
    upsert(p); const e = EV[id];
    if (voided(e)) return "V";
    if (finished(e) && e.hs !== null && e.as !== null) return e.hs > e.as ? "H" : e.hs < e.as ? "A" : (e.draw ? "D" : "V");
    return null;
  }
  BB.sports = { EV, RES, LEAGUES, state, load, loadLive, phase, fetchResult, list: () => Object.values(EV),
    label: s => LABEL[s] || s, icon: s => ICON[s] || "🏅", leagueRank: n => { const i = LEAGUES.findIndex(l => l.n === n); return i < 0 ? 99 : i; } };
})(window.BB);
