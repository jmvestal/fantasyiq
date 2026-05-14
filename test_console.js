// ═══════════════════════════════════════════════════════════════════
// Fantasy HQ — Browser Console Test Suite
// HOW TO USE:
//   1. Open https://myfantasyhq.com in Chrome (NOT logged in)
//   2. Open DevTools → Console (F12)
//   3. Paste this entire script and hit Enter
//   4. Results print immediately with ✅ PASS / ❌ FAIL
// ═══════════════════════════════════════════════════════════════════

(function runTests() {
  const results = [];
  let passed = 0, failed = 0;

  function test(name, fn) {
    try {
      const result = fn();
      if (result === true || result === undefined) {
        console.log(`✅ ${name}`);
        results.push({ name, ok: true });
        passed++;
      } else {
        console.warn(`❌ ${name} — ${result}`);
        results.push({ name, ok: false, reason: result });
        failed++;
      }
    } catch(e) {
      console.error(`❌ ${name} — threw: ${e.message}`);
      results.push({ name, ok: false, reason: e.message });
      failed++;
    }
  }

  function section(title) {
    console.log(`\n${'─'.repeat(50)}\n  ${title}\n${'─'.repeat(50)}`);
  }

  // ── Helper: make a mock player ────────────────────────────
  function mkPlayer(full_name, position, dynasty_val, redraft_val, opts = {}) {
    return { full_name, position, dynasty_val, redraft_val,
      team: opts.team || 'ATL', age: opts.age || 26,
      trend: opts.trend || 'flat', rookie: opts.rookie || false };
  }

  // ── Wait for app to be ready ─────────────────────────────
  if (!window.S) { console.error('❌ S not found — is this myfantasyhq.com?'); return; }
  if (!S.ready)  { console.warn('⚠️  App not fully loaded yet — wait a few seconds and re-run'); return; }

  // ══════════════════════════════════════════════════════════
  section('1 · APP STATE & DEFAULTS');
  // ══════════════════════════════════════════════════════════

  test('S object exists', () => !!window.S);
  test('App is ready', () => S.ready === true);
  test('Players loaded', () => S.players?.length > 100 || `only ${S.players?.length} players`);
  test('Default mode is dynasty', () => S.settings.mode === 'dynasty' || `got: ${S.settings.mode}`);
  test('Default QB format is SF', () => S.settings.qb === 'sf' || `got: ${S.settings.qb}`);
  test('Default size is 12', () => S.settings.size === 12 || `got: ${S.settings.size}`);
  test('Default scoring is PPR', () => S.settings.scoring === 'ppr' || `got: ${S.settings.scoring}`);
  test('VALUE_DB exists and has entries', () => {
    const count = Object.keys(VALUE_DB || {}).length;
    return count > 100 || `only ${count} entries`;
  });

  // ══════════════════════════════════════════════════════════
  section('2 · PLAYER DATA STRUCTURE');
  // ══════════════════════════════════════════════════════════

  const positions = ['QB','RB','WR','TE'];
  positions.forEach(pos => {
    test(`Has ${pos} players`, () => {
      const count = S.players.filter(p => p.position === pos).length;
      return count >= 5 || `only ${count} ${pos}s`;
    });
  });

  test('Players have dynasty_val', () => {
    const missing = S.players.filter(p => positions.includes(p.position) && !p.dynasty_val).length;
    return missing === 0 || `${missing} players missing dynasty_val`;
  });

  test('Players have redraft_val', () => {
    const missing = S.players.filter(p => positions.includes(p.position) && !p.redraft_val).length;
    return missing === 0 || `${missing} players missing redraft_val`;
  });

  test('Top dynasty values are in realistic range (3000–10000)', () => {
    const top5 = [...S.players].filter(p => positions.includes(p.position))
      .sort((a,b) => b.dynasty_val - a.dynasty_val).slice(0,5);
    const outOfRange = top5.filter(p => p.dynasty_val < 3000 || p.dynasty_val > 10000);
    return outOfRange.length === 0 ||
      `Out of range: ${outOfRange.map(p => `${p.full_name}=${p.dynasty_val}`).join(', ')}`;
  });

  // ══════════════════════════════════════════════════════════
  section('3 · RANKING RULE 1 — QB ORDERING CONSISTENCY');
  // ══════════════════════════════════════════════════════════

  function getQBRank(qbFormat, idx) {
    const over = { ...S.settings, mode:'dynasty', qb: qbFormat };
    return [...S.players]
      .filter(p => p.position === 'QB')
      .sort((a,b) => calcValue(b, over) - calcValue(a, over))[idx];
  }

  test('QB1 is same player in 1QB, SF, and 2QB', () => {
    const q1 = getQBRank('1qb', 0)?.full_name;
    const sf = getQBRank('sf',  0)?.full_name;
    const tq = getQBRank('2qb', 0)?.full_name;
    return (q1 === sf && sf === tq) ||
      `1QB: ${q1} | SF: ${sf} | 2QB: ${tq}`;
  });

  test('QB2 is same player in 1QB, SF, and 2QB', () => {
    const q1 = getQBRank('1qb', 1)?.full_name;
    const sf = getQBRank('sf',  1)?.full_name;
    const tq = getQBRank('2qb', 1)?.full_name;
    return (q1 === sf && sf === tq) ||
      `1QB: ${q1} | SF: ${sf} | 2QB: ${tq}`;
  });

  test('SF QB values are higher than 1QB QB values', () => {
    const qb = S.players.find(p => p.position === 'QB' && p.dynasty_val > 5000);
    if (!qb) return 'no elite QB found';
    const v1 = calcValue(qb, { ...S.settings, mode:'dynasty', qb:'1qb' });
    const sf = calcValue(qb, { ...S.settings, mode:'dynasty', qb:'sf'  });
    return sf > v1 || `SF (${sf}) not > 1QB (${v1}) for ${qb.full_name}`;
  });

  test('2QB QB values are higher than SF QB values', () => {
    const qb = S.players.find(p => p.position === 'QB' && p.dynasty_val > 5000);
    if (!qb) return 'no elite QB found';
    const sf = calcValue(qb, { ...S.settings, mode:'dynasty', qb:'sf'  });
    const tq = calcValue(qb, { ...S.settings, mode:'dynasty', qb:'2qb' });
    return tq > sf || `2QB (${tq}) not > SF (${sf}) for ${qb.full_name}`;
  });

  // ══════════════════════════════════════════════════════════
  section('4 · RANKING RULE 2 — LEAGUE SIZE SCARCITY');
  // ══════════════════════════════════════════════════════════

  test('QBs worth more in 16-team than 8-team (1QB)', () => {
    const qb = S.players.find(p => p.position === 'QB' && p.dynasty_val > 5000);
    if (!qb) return 'no elite QB found';
    const v8  = calcValue(qb, { ...S.settings, mode:'dynasty', qb:'1qb', size:8  });
    const v16 = calcValue(qb, { ...S.settings, mode:'dynasty', qb:'1qb', size:16 });
    return v16 > v8 || `8-team (${v8}) >= 16-team (${v16})`;
  });

  test('Non-QB skill players worth more in 16-team than 8-team', () => {
    const rb = S.players.find(p => p.position === 'RB' && p.dynasty_val > 4000);
    if (!rb) return 'no elite RB found';
    const v8  = calcValue(rb, { ...S.settings, mode:'dynasty', size:8  });
    const v16 = calcValue(rb, { ...S.settings, mode:'dynasty', size:16 });
    return v16 > v8 || `8-team (${v8}) >= 16-team (${v16}) for ${rb.full_name}`;
  });

  // ══════════════════════════════════════════════════════════
  section('5 · RANKING RULE 3 — TE PREMIUM (LARGE LEAGUES)');
  // ══════════════════════════════════════════════════════════

  test('Elite TE worth more in 16-team than 8-team', () => {
    const te = S.players.filter(p => p.position === 'TE').sort((a,b) => b.dynasty_val - a.dynasty_val)[0];
    if (!te) return 'no TE found';
    const v8  = calcValue(te, { ...S.settings, mode:'dynasty', size:8  });
    const v16 = calcValue(te, { ...S.settings, mode:'dynasty', size:16 });
    return v16 > v8 || `8-team (${v8}) >= 16-team (${v16}) for ${te.full_name}`;
  });

  // ══════════════════════════════════════════════════════════
  section('6 · RANKING RULE 4 — SCORING FORMAT ADJUSTMENTS');
  // ══════════════════════════════════════════════════════════

  test('RB worth more in STD than PPR (dynasty)', () => {
    const rb = S.players.find(p => p.position === 'RB' && p.dynasty_val > 4000);
    if (!rb) return 'no elite RB found';
    const ppr = calcValue(rb, { ...S.settings, mode:'dynasty', scoring:'ppr' });
    const std = calcValue(rb, { ...S.settings, mode:'dynasty', scoring:'std' });
    return std > ppr || `STD (${std}) not > PPR (${ppr}) for ${rb.full_name}`;
  });

  test('WR worth more in PPR than STD (dynasty)', () => {
    const wr = S.players.find(p => p.position === 'WR' && p.dynasty_val > 4000);
    if (!wr) return 'no elite WR found';
    const ppr = calcValue(wr, { ...S.settings, mode:'dynasty', scoring:'ppr' });
    const std = calcValue(wr, { ...S.settings, mode:'dynasty', scoring:'std' });
    return ppr > std || `PPR (${ppr}) not > STD (${std}) for ${wr.full_name}`;
  });

  test('RB STD boost is meaningful (>10%)', () => {
    const rb = S.players.find(p => p.position === 'RB' && p.dynasty_val > 4000);
    if (!rb) return 'no elite RB found';
    const ppr = calcValue(rb, { ...S.settings, mode:'dynasty', scoring:'ppr' });
    const std = calcValue(rb, { ...S.settings, mode:'dynasty', scoring:'std' });
    const pct = ((std - ppr) / ppr * 100).toFixed(1);
    return (std - ppr) / ppr > 0.10 || `STD boost only ${pct}% (want >10%)`;
  });

  test('RB worth more in STD than PPR (redraft)', () => {
    const rb = S.players.find(p => p.position === 'RB' && p.redraft_val > 3000);
    if (!rb) return 'no elite RB found';
    const ppr = calcValue(rb, { ...S.settings, mode:'redraft', scoring:'ppr' });
    const std = calcValue(rb, { ...S.settings, mode:'redraft', scoring:'std' });
    return std > ppr || `STD (${std}) not > PPR (${ppr}) for ${rb.full_name}`;
  });

  // ══════════════════════════════════════════════════════════
  section('7 · RANKING RULE 5 — STABILITY CAP');
  // ══════════════════════════════════════════════════════════

  test('buildConsensus caps extreme outlier sources at ±25%', () => {
    const player = S.players.find(p => p.position === 'RB' && p.dynasty_val > 5000);
    if (!player) return 'no elite RB found';
    const vdb = VALUE_DB[player.full_name];
    if (!vdb) return `no VALUE_DB entry for ${player.full_name}`;
    // Inject a wildly inflated source value
    const testKey = '__test_outlier__';
    S.sourceValues[testKey] = {};
    S.sourceValues[testKey][normName(player.full_name)] = { dv: vdb.dv * 5, rv: 0 }; // 5× inflation
    const c = buildConsensus(player);
    delete S.sourceValues[testKey];
    const maxAllowed = vdb.dv * 1.25;
    return c.dv <= maxAllowed ||
      `Outlier not capped: got ${c.dv}, max allowed ${maxAllowed.toFixed(0)} (base: ${vdb.dv})`;
  });

  test('buildConsensus resists extreme deflation at -25%', () => {
    const player = S.players.find(p => p.position === 'WR' && p.dynasty_val > 5000);
    if (!player) return 'no elite WR found';
    const vdb = VALUE_DB[player.full_name];
    if (!vdb) return `no VALUE_DB entry for ${player.full_name}`;
    const testKey = '__test_deflate__';
    S.sourceValues[testKey] = {};
    S.sourceValues[testKey][normName(player.full_name)] = { dv: vdb.dv * 0.1, rv: 0 }; // 90% deflation
    const c = buildConsensus(player);
    delete S.sourceValues[testKey];
    const minAllowed = vdb.dv * 0.75;
    return c.dv >= minAllowed ||
      `Deflation not capped: got ${c.dv}, min allowed ${minAllowed.toFixed(0)} (base: ${vdb.dv})`;
  });

  // ══════════════════════════════════════════════════════════
  section('8 · TRADE ANALYZER');
  // ══════════════════════════════════════════════════════════

  test('calcValue returns a number for all player positions', () => {
    const bad = S.players.filter(p => {
      const v = calcValue(p);
      return typeof v !== 'number' || isNaN(v) || v < 0;
    });
    return bad.length === 0 || `${bad.length} players with bad values: ${bad.slice(0,3).map(p=>p.full_name).join(', ')}`;
  });

  test('gradeTradeBalance function exists', () => typeof window.gradeTradeBalance === 'function' ||
    (typeof window.runAnalysis === 'function' ? 'uses runAnalysis (ok)' : 'neither found'));

  test('Trade side A and B arrays exist', () => Array.isArray(S.tradeA) && Array.isArray(S.tradeB));

  // ══════════════════════════════════════════════════════════
  section('9 · DYNASTY vs REDRAFT VALUES');
  // ══════════════════════════════════════════════════════════

  test('Redraft mode returns different values than dynasty', () => {
    const rb = S.players.find(p => p.position === 'RB' && p.dynasty_val > 4000 && p.redraft_val > 0);
    if (!rb) return 'no RB with both values found';
    const dv = calcValue(rb, { ...S.settings, mode:'dynasty' });
    const rv = calcValue(rb, { ...S.settings, mode:'redraft' });
    return dv !== rv || `dynasty (${dv}) === redraft (${rv}) — same value, may be a bug`;
  });

  test('Rookie dynasty value is higher than redraft (long-term upside)', () => {
    const rookies = S.players.filter(p => p.rookie && positions.includes(p.position) && p.dynasty_val > 1000);
    if (!rookies.length) return 'no rookies with dynasty values loaded';
    const { p } = rookies.map(p => ({ p, dv: p.dynasty_val, rv: p.redraft_val || 0 }))
      .sort((a,b) => b.dv - a.dv)[0];
    const dv = calcValue(p, { ...S.settings, mode:'dynasty' });
    const rv = calcValue(p, { ...S.settings, mode:'redraft' });
    return dv > rv || `Top rookie ${p.full_name}: dynasty (${dv}) <= redraft (${rv})`;
  });

  // ══════════════════════════════════════════════════════════
  section('10 · UI ELEMENTS & DOM');
  // ══════════════════════════════════════════════════════════

  const tabs = ['home','analyzer','values','wire','buysell','roster','draft','league'];
  tabs.forEach(tab => {
    test(`Tab #tab-${tab} exists in DOM`, () => !!document.getElementById(`tab-${tab}`) ||
      `#tab-${tab} not found`);
  });

  test('Global ticker bar exists', () => !!document.getElementById('globalTickerBar'));
  test('Landing ticker exists', () => !!document.getElementById('homeTickerWrap'));
  test('Position rankings section exists', () => !!document.getElementById('homePosRank'));
  test('Position rank list exists', () => !!document.getElementById('homePosRankList'));
  test('Chat button exists (hidden for guests)', () => {
    const btn = document.getElementById('tiqChatBtn');
    if (!btn) return 'chat button not found';
    const visible = getComputedStyle(btn).display !== 'none';
    return !visible || 'chat button is VISIBLE for guest — should be hidden';
  });
  test('Sign In button visible for guests', () => {
    const btn = document.getElementById('authBtn');
    return btn && getComputedStyle(btn).display !== 'none' || 'authBtn hidden or missing';
  });

  // ══════════════════════════════════════════════════════════
  section('11 · LANDING PAGE WIDGETS');
  // ══════════════════════════════════════════════════════════

  test('buildNewsItems() returns items', () => {
    const items = buildNewsItems();
    return items.length > 0 || 'returned empty array';
  });

  test('News items have required fields', () => {
    const items = buildNewsItems();
    const bad = items.filter(i => !i.emoji || !i.text || !i.pos);
    return bad.length === 0 || `${bad.length} items missing fields`;
  });

  test('renderPosRank runs without error for all positions', () => {
    try {
      ['RB','WR','QB','TE'].forEach(pos => renderPosRank(pos));
      return true;
    } catch(e) { return e.message; }
  });

  test('setPosRankMode runs without error', () => {
    try {
      setPosRankMode('dynasty');
      setPosRankMode('redraft');
      setPosRankMode('dynasty'); // reset
      return true;
    } catch(e) { return e.message; }
  });

  test('Position rankings list has rows after render', () => {
    renderPosRank('RB');
    const list = document.getElementById('homePosRankList');
    return list && list.children.length > 0 || 'no rows rendered';
  });

  // ══════════════════════════════════════════════════════════
  section('12 · SETTINGS & PERSISTENCE');
  // ══════════════════════════════════════════════════════════

  test('setSetting function exists', () => typeof setSetting === 'function');

  test('Settings change is reflected in calcValue', () => {
    const rb = S.players.find(p => p.position === 'RB' && p.dynasty_val > 4000);
    if (!rb) return 'no elite RB found';
    const before = calcValue(rb, { ...S.settings, scoring:'ppr' });
    const after  = calcValue(rb, { ...S.settings, scoring:'std' });
    return before !== after || 'scoring change had no effect on RB value';
  });

  test('normName function works correctly', () => {
    const cases = [
      [normName('Ja\'Marr Chase'), 'jamarr chase'],
      [normName('D.K. Metcalf'),   'dk metcalf'],
      [normName('Travis Kelce Jr.'), 'travis kelce'],
    ];
    const failed = cases.filter(([got, want]) => got !== want);
    return failed.length === 0 ||
      failed.map(([g,w]) => `got "${g}" want "${w}"`).join('; ');
  });

  // ══════════════════════════════════════════════════════════
  section('13 · VALUE SANITY CHECKS');
  // ══════════════════════════════════════════════════════════

  test('No player has a negative value', () => {
    const neg = S.players.filter(p => calcValue(p) < 0);
    return neg.length === 0 || `${neg.length} players with negative values`;
  });

  test('No player has a value over 11000', () => {
    const over = S.players.filter(p => calcValue(p) > 11000);
    return over.length === 0 ||
      `${over.length} players over 11000: ${over.map(p => `${p.full_name}=${calcValue(p)}`).join(', ')}`;
  });

  test('Top RB is more valuable than top K in dynasty', () => {
    const topRB = [...S.players].filter(p => p.position === 'RB')
      .sort((a,b) => calcValue(b) - calcValue(a))[0];
    const topK  = [...S.players].filter(p => p.position === 'K')
      .sort((a,b) => calcValue(b) - calcValue(a))[0];
    if (!topK) return true; // no kickers loaded, fine
    const rbV = calcValue(topRB), kV = calcValue(topK);
    return rbV > kV || `Top K (${topK?.full_name} ${kV}) >= Top RB (${topRB?.full_name} ${rbV})`;
  });

  test('QBs have higher values in 2QB than non-QB skill players on average', () => {
    const over = { ...S.settings, mode:'dynasty', qb:'2qb', size:16 };
    const qbs = S.players.filter(p => p.position === 'QB').map(p => calcValue(p, over));
    const rbs = S.players.filter(p => p.position === 'RB').map(p => calcValue(p, over));
    const avgQB = qbs.reduce((s,v)=>s+v,0) / qbs.length;
    const avgRB = rbs.reduce((s,v)=>s+v,0) / rbs.length;
    return avgQB > avgRB ||
      `Avg QB (${avgQB.toFixed(0)}) not > Avg RB (${avgRB.toFixed(0)}) in 2QB 16-team`;
  });

  // ══════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════
  const total = passed + failed;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  RESULTS: ${passed}/${total} passed  ${failed > 0 ? `| ${failed} FAILED` : '| ALL CLEAR ✅'}`);
  console.log(`${'═'.repeat(50)}`);

  if (failed > 0) {
    console.log('\n⚠️  FAILED TESTS:');
    results.filter(r => !r.ok).forEach(r => console.warn(`  ❌ ${r.name}\n     → ${r.reason}`));
  }

  // Return summary object for programmatic use
  return { passed, failed, total, results };
})();
