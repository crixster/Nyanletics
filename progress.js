// =====================================================================
// progress.js — Nyanletics: Progress tab (self-installing)
// Adds its own nav button + #progressTab and wraps switchTab().
// Reads: exercises[] (lifting-log.js), foodLogs + goals (macro-tracker.js).
// Owns:  localStorage 'nyanletics_progress' =
//        { weights:[{date,kg?,bf?,mm?}], unit, open:{section:bool} }
// =====================================================================
(function () {
  'use strict';
  const KEY = 'nyanletics_progress', DAY = 864e5, LB = 2.20462;
  const RANGES = [[7, '1W'], [28, '4W'], [90, '3M'], [180, '6M'], [365, '1Y'], [0, 'All']];
  const CARD = 'glass-card rounded-2xl p-4 shadow-xl';
  const INP = 'bg-slate-900/70 border border-slate-700 rounded-xl px-2.5 py-2 text-sm text-white min-w-0';
  const SUB = 'text-[10px] uppercase tracking-wider text-slate-400 font-bold';
  let P = { weights: [], unit: 'kg', open: {} }, range = 90, off = 0, moff = 0, wm = 'kg', sel = '', q = '', shown = [], vmode = 'cycle', vsel = -1;
  const TIPS = {};
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.weights)) P = Object.assign(P, s); } catch (e) {}
  P.open = P.open || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const tms = s => new Date(s + 'T00:00:00').getTime();
  const fd = x => new Date(typeof x === 'string' ? tms(x) : x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const disp = kg => P.unit === 'lb' ? kg * LB : kg;
  const f1 = n => String(Math.round(n * 10) / 10);
  const big = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
  const EX = () => (typeof exercises !== 'undefined' && Array.isArray(exercises)) ? exercises : [];
  const FL = () => (typeof foodLogs !== 'undefined' && foodLogs) ? foodLogs : {};
  const GL = () => (typeof goals !== 'undefined' && goals) ? goals : {};
  const toKg = e => e.unit === 'lb' ? e.weight * 0.45359237 : e.weight;
  const e1 = (w, r) => (typeof calculate1RM === 'function') ? calculate1RM(w, r) : (w <= 0 || !r ? 0 : r === 1 ? w : w * (1 + r / 30));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const addD = (s, n) => { const d = new Date(tms(s)); d.setDate(d.getDate() + n); return iso(d); };
  const todayMs = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); };

  // ---------- date window (range + back/forward offset) ----------
  function win() { if (!range) return [0, Infinity]; const e = todayMs() + off * range * DAY; return [e - (range - 1) * DAY, e]; }
  const inWin = d => { const w = win(), t = tms(d); return t >= w[0] && t <= w[1]; };
  const winLabel = () => { const w = win(); return range ? (range === 1 ? fd(w[1]) : fd(w[0]) + ' – ' + fd(w[1])) : 'All time'; };
  const daily = () => range > 0 && range <= 28;
  function keyOf(d) { if (daily()) return d; const t = new Date(tms(d)); t.setDate(t.getDate() - t.getDay()); return iso(t); }

  // ---------- body composition ----------
  const MET = { kg: ['Weight', v => disp(v), () => P.unit], bf: ['Body fat', v => v, () => '%'], mm: ['Muscle', v => disp(v), () => P.unit] };
  const sortedW = () => P.weights.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const wts = () => sortedW().filter(w => w.kg != null);
  function bwAt(date) { const w = wts(); if (!w.length) return null; let r = w[0].kg; w.forEach(x => { if (x.date <= date) r = x.kg; }); return r; }
  function movAvg(a, k) {
    return a.map(p => {
      const t = tms(p.date), win7 = a.filter(v => { const u = tms(v.date); return u <= t && u > t - 7 * DAY; });
      return { date: p.date, v: win7.reduce((s, v) => s + v[k], 0) / win7.length };
    });
  }

  // ---------- strength + volume ----------
  function liftNames() {
    const m = {};
    EX().forEach(e => { const k = (e.name || '').trim(); if (!k) return; const l = k.toLowerCase(); m[l] = m[l] || { name: k, n: 0 }; m[l].n++; });
    return Object.values(m).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }
  function liftSeries(name) {
    const ents = EX().filter(e => (e.name || '').trim().toLowerCase() === name.toLowerCase());
    const isBW = ents.some(e => e.isBW), reps = isBW && !wts().length, best = {};
    ents.forEach(e => {
      const v = reps ? Number(e.reps) : e1(toKg(e) + (e.isBW ? (bwAt(e.date) || 0) : 0), e.reps);
      if (v > 0 && (!best[e.date] || v > best[e.date].v)) best[e.date] = { date: e.date, v, e };
    });
    const pts = Object.values(best).sort((a, b) => a.date < b.date ? -1 : 1);
    let mx = 0; pts.forEach((p, i) => { p.pr = i > 0 && p.v > mx; mx = Math.max(mx, p.v); });
    return { pts, reps, isBW };
  }
  const fmtV = (v, reps) => reps ? v + ' reps' : f1(disp(v)) + ' ' + P.unit;
  const vol = e => (e.sets || 1) * (e.reps || 0) * (toKg(e) + (e.isBW ? (bwAt(e.date) || 0) : 0));
  function activity() { return { L: new Set(EX().map(e => e.date)), F: new Set(Object.keys(FL()).filter(k => (FL()[k] || []).length)) }; }

  // ---------- SVG charts ----------
  const none = '<p class="text-xs text-slate-500 py-8 text-center">Not enough data in this period.</p>';
  function chart(id, lines, marks) {
    const all = lines.flatMap(l => l.pts);
    if (all.length < 2) return none;
    const W = 320, H = 150, L = 34, R = 8, T = 8, B = 20;
    let x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x)), y0 = Math.min(...all.map(p => p.y)), y1 = Math.max(...all.map(p => p.y));
    if (y1 === y0) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad; if (x1 === x0) x1 += DAY;
    const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="w-full select-none" onclick="PG.tap('${id}',event)">`;
    for (let i = 0; i < 3; i++) { const v = y0 + (y1 - y0) * i / 2, y = Y(v); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#334155" stroke-width=".5"/><text x="${L - 4}" y="${y + 3}" text-anchor="end" font-size="8" fill="#94a3b8">${Math.round(v * 10) / 10}</text>`; }
    s += `<text x="${L}" y="${H - 5}" font-size="8" fill="#94a3b8">${fd(x0)}</text><text x="${W - R}" y="${H - 5}" text-anchor="end" font-size="8" fill="#94a3b8">${fd(x1)}</text>`;
    lines.forEach(l => {
      if (l.w !== 0 && l.pts.length > 1) s += `<polyline fill="none" stroke="${l.c}" stroke-width="${l.w || 2}" stroke-linejoin="round" stroke-linecap="round" points="${l.pts.map(p => X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ')}"/>`;
      if (l.dots) l.pts.forEach(p => { s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2" fill="${l.c}" opacity=".55"/>`; });
    });
    (marks || []).forEach(p => { s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" fill="#fbbf24" stroke="#0f172a" stroke-width="1"/>`; });
    TIPS[id] = all.map(p => ({ px: X(p.x) / W, l: p.l }));
    return s + '</svg>';
  }
  function bars(id, items, goal, color, sel) {
    if (!items.length) return none;
    const W = 320, H = 135, L = 34, R = 8, T = 8, B = 20, mx = Math.max(goal || 0, ...items.map(i => i.y)) * 1.1 || 1;
    const bw = (W - L - R) / items.length, Y = y => T + (1 - y / mx) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="w-full select-none" onclick="PG.tap('${id}',event)">`;
    [0, 0.5, 1].forEach(f => { const y = Y(mx * f); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#334155" stroke-width=".5"/><text x="${L - 4}" y="${y + 3}" text-anchor="end" font-size="8" fill="#94a3b8">${big(mx * f)}</text>`; });
    items.forEach((it, i) => { s += `<rect x="${(L + i * bw + bw * 0.12).toFixed(1)}" y="${Y(it.y).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${(H - B - Y(it.y)).toFixed(1)}" rx="2" fill="${i === sel ? '#a5b4fc' : (color || '#6366f1')}"/>`; });
    if (goal) s += `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#fbbf24" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += `<text x="${L}" y="${H - 5}" font-size="8" fill="#94a3b8">${items[0].lab}</text><text x="${W - R}" y="${H - 5}" text-anchor="end" font-size="8" fill="#94a3b8">${items[items.length - 1].lab}</text>`;
    TIPS[id] = items.map((it, i) => ({ px: (L + (i + 0.5) * bw) / W, l: it.l, i }));
    return s + '</svg>';
  }
  const cap = (id, txt) => `<div id="cap-${id}" class="text-[11px] text-indigo-300 min-h-[16px] text-center">${txt || 'Tap the chart to read a value'}</div>`;
  const sec = (id, title, sub, body) => {
    const o = P.open[id] !== false;
    return `<div class="${CARD}"><button onclick="PG.tog('${id}')" class="w-full flex items-center justify-between text-left"><span class="text-sm font-bold text-white">${title} <span class="text-[11px] font-normal text-slate-400">${sub || ''}</span></span><span class="text-slate-400 text-xs">${o ? '▾' : '▸'}</span></button>${o ? `<div class="mt-3">${body()}</div>` : ''}</div>`;
  };

  // ---------- sections ----------
  function summary() {
    const w = wts(), last = w[w.length - 1];
    const rm = movAvg(w, 'kg').filter(x => inWin(x.date)), d = rm.length > 1 ? rm[rm.length - 1].v - rm[0].v : null;
    const wk = new Set(EX().map(e => e.date).filter(x => tms(x) >= Date.now() - 7 * DAY)).size;
    const days = Object.keys(FL()).filter(k => (FL()[k] || []).length && tms(k) >= Date.now() - 7 * DAY);
    const kc = days.length ? days.reduce((a, k) => a + FL()[k].reduce((s, i) => s + (Number(i.cal) || 0), 0), 0) / days.length : null;
    let prs = 0; liftNames().forEach(n => liftSeries(n.name).pts.forEach(p => { if (p.pr && tms(p.date) >= Date.now() - 30 * DAY) prs++; }));
    const box = (l, v, s) => `<div class="${CARD} !p-3"><div class="${SUB}">${l}</div><div class="text-xl font-extrabold text-white mt-0.5">${v}</div><div class="text-[11px] text-slate-400">${s}</div></div>`;
    return `<div class="grid grid-cols-2 gap-2.5">
      ${box('Body weight', last ? f1(disp(last.kg)) + ' <span class="text-xs font-semibold text-slate-400">' + P.unit + '</span>' : '--', d == null ? 'Log 2+ entries' : (d > 0 ? '▲ ' : '▼ ') + f1(Math.abs(disp(d))) + ' ' + P.unit + ' in period')}
      ${box('This week', wk + ' <span class="text-xs font-semibold text-slate-400">days</span>', 'lifting days, last 7d')}
      ${box('Avg calories', kc == null ? '--' : Math.round(kc), GL().cal ? 'goal ' + GL().cal + ' kcal' : 'last 7 logged days')}
      ${box('New PRs', prs, 'last 30 days')}</div>`;
  }

  function bodyBody() {
    const m = MET[wm], all = sortedW().filter(w => w[wm] != null), ma = movAvg(all, wm), u = m[2]();
    const lab = (w, v, x) => `${w.date}: ${f1(m[1](v))} ${u}${x || ''}`;
    const raw = all.filter(w => inWin(w.date)).map(w => ({ x: tms(w.date), y: m[1](w[wm]), l: lab(w, w[wm]) }));
    const avg = ma.filter(w => inWin(w.date)).map(w => ({ x: tms(w.date), y: m[1](w.v), l: lab(w, w.v, ' (7-day avg)') }));
    const recent = sortedW().slice(-5).reverse().map(w => `<div class="flex items-center justify-between text-xs text-slate-300 py-1 border-b border-slate-700/40 last:border-0"><span>${w.date}</span><span class="font-semibold">${[w.kg != null ? f1(disp(w.kg)) + P.unit : '', w.bf != null ? w.bf + '%' : '', w.mm != null ? f1(disp(w.mm)) + P.unit + ' muscle' : ''].filter(Boolean).join(' · ')}</span><button onclick="PG.delW('${w.date}')" class="text-slate-500 hover:text-rose-400 px-2" aria-label="Delete">✕</button></div>`).join('');
    return `<div class="flex gap-1 mb-3">${Object.keys(MET).map(k => `<button onclick="PG.metric('${k}')" class="flex-1 text-[11px] font-bold py-1.5 rounded-lg ${k === wm ? 'bg-indigo-600 text-white' : 'bg-slate-900/70 text-slate-300'}">${MET[k][0]}</button>`).join('')}</div>
      <div class="grid grid-cols-3 gap-2 mb-2"><input id="pgW" type="number" step="0.1" inputmode="decimal" placeholder="Weight (${P.unit})" class="${INP}"><input id="pgB" type="number" step="0.1" inputmode="decimal" placeholder="Body fat %" class="${INP}"><input id="pgM" type="number" step="0.1" inputmode="decimal" placeholder="Muscle (${P.unit})" class="${INP}"></div>
      <div class="flex gap-2 mb-3"><input id="pgD" type="date" value="${iso(new Date())}" class="${INP} flex-1 !text-xs"><button onclick="PG.addW()" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl px-5">Save entry</button></div>
      <div class="text-[10px] text-slate-400 text-right mb-1"><span style="color:#818cf8">━</span> 7-day avg &nbsp;<span>●</span> entries</div>
      ${chart('w', [{ pts: raw, c: '#94a3b8', dots: true, w: 0 }, { pts: avg, c: '#818cf8', w: 2.4 }])}${cap('w')}
      ${recent ? `<div class="mt-2">${recent}</div>` : ''}`;
  }

  function strengthBody() {
    const names = liftNames(); shown = names.filter(n => !q || n.name.toLowerCase().includes(q.toLowerCase()));
    if (!shown.length) return `<input id="pgQ" value="${esc(q)}" oninput="PG.search(this.value)" placeholder="Search lifts…" class="${INP} w-full mb-2"><p class="text-xs text-slate-500">${names.length ? 'No lifts match.' : 'Log a lift in the Lifting Log to see progress here.'}</p>`;
    if (!shown.some(n => n.name.toLowerCase() === sel)) sel = shown[0].name.toLowerCase();
    const cur = shown.find(n => n.name.toLowerCase() === sel), S = liftSeries(cur.name), pts = S.pts.filter(p => inWin(p.date));
    const y = v => S.reps ? v : disp(v);
    const line = pts.map(p => ({ x: tms(p.date), y: y(p.v), l: `${p.date}: ${fmtV(p.v, S.reps)} (${p.e.sets || '?'}×${p.e.reps} @ ${p.e.isBW ? 'BW' + (p.e.weight > 0 ? '+' + p.e.weight : '') : p.e.weight + p.e.unit})` }));
    const marks = pts.filter(p => p.pr).map(p => ({ x: tms(p.date), y: y(p.v) }));
    const top = S.pts.reduce((a, p) => (!a || p.v > a.v) ? p : a, null);
    const recs = pts.slice().reverse().slice(0, 8).map(p => `<div class="flex justify-between text-xs text-slate-300 py-1 border-b border-slate-700/40 last:border-0"><span>${p.pr ? '🏅' : '•'} ${p.date} <span class="text-slate-500">${p.e.sets || '?'}×${p.e.reps} @ ${p.e.isBW ? 'BW' + (p.e.weight > 0 ? '+' + p.e.weight : '') : p.e.weight + p.e.unit}</span></span><span class="font-semibold ${p.pr ? 'text-amber-300' : ''}">${fmtV(p.v, S.reps)}</span></div>`).join('');
    const allRows = shown.map((n, i) => { const s = liftSeries(n.name), b = s.pts.reduce((a, p) => (!a || p.v > a.v) ? p : a, null); return `<button onclick="PG.setLift(${i})" class="w-full flex justify-between text-xs py-1.5 border-b border-slate-700/40 last:border-0 ${n.name.toLowerCase() === sel ? 'text-indigo-300' : 'text-slate-300'}"><span>${esc(n.name)}</span><span class="font-semibold">${b ? fmtV(b.v, s.reps) + ' <span class="text-slate-500 font-normal">' + fd(b.date) + '</span>' : '--'}</span></button>`; }).join('');
    return `<input id="pgQ" value="${esc(q)}" oninput="PG.search(this.value)" placeholder="Search lifts…" class="${INP} w-full mb-2">
      <div class="flex gap-1.5 overflow-x-auto pb-2">${shown.map((x, i) => `<button onclick="PG.setLift(${i})" class="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full ${x.name.toLowerCase() === sel ? 'bg-indigo-600 text-white' : 'bg-slate-900/70 text-slate-300'}">${esc(x.name)}</button>`).join('')}</div>
      <p class="text-[11px] text-slate-400 mb-1">${S.reps ? 'Best reps per session (log body weight for 1RM)' : S.isBW ? 'Estimated 1RM incl. body weight' : 'Estimated 1RM'}${top ? ` · best ever <b class="text-amber-300">${fmtV(top.v, S.reps)}</b>` : ''}</p>
      ${chart('s', [{ pts: line, c: '#818cf8', dots: true }], marks)}${cap('s', 'Gold dots are PRs. Tap the chart to read a value')}
      ${recs ? `<div class="mt-2"><div class="${SUB} mb-1">1RM records in period</div>${recs}</div>` : ''}
      <div class="mt-3"><div class="${SUB} mb-1">Best 1RM, all lifts</div>${allRows}</div>`;
  }

  // ---------- fun equivalents for lifted volume ----------
  const OBJ = [ // [kg, emoji, singular, plural, trivia]
    [4, '🐈', 'house cat', 'house cats', 'Cats sleep roughly 12–16 hours a day.'],
    [7, '🎳', 'bowling ball', 'bowling balls', 'Regulation bowling balls max out at 16 lb (about 7.3 kg).'],
    [100, '🐼', 'giant panda', 'giant pandas', 'Pandas can eat over 10 kg of bamboo in a single day.'],
    [190, '🦁', 'adult lion', 'adult lions', 'A lion’s roar can be heard from several kilometres away.'],
    [300, '🎹', 'grand piano', 'grand pianos', 'A standard piano has 88 keys and roughly 230 strings.'],
    [500, '🐎', 'horse', 'horses', 'Horses can doze standing up thanks to a locking mechanism in their legs.'],
    [1200, '🚗', 'small car', 'small cars', 'Karl Benz’s 1886 Motorwagen had three wheels and under 1 horsepower.'],
    [1500, '🦛', 'hippo', 'hippos', 'Hippos can’t really swim. They push off the riverbed in bounding strides.'],
    [5000, '🐘', 'elephant', 'elephants', 'Elephants can recognise themselves in a mirror.'],
    [8000, '🦖', 'T. rex', 'T. rexes', 'T. rex had an estimated bite force far beyond any living land animal.'],
    [11000, '🚌', 'school bus', 'school buses', 'School-bus yellow was standardised in 1939 because it stands out in peripheral vision.'],
    [140000, '🐋', 'blue whale', 'blue whales', 'Blue whales are the heaviest animals known to have ever lived.'],
    [204000, '🗽', 'Statue of Liberty', 'Statues of Liberty', 'Its copper skin is only about 2.4 mm thick, roughly two pennies.'],
    [10100000, '🗼', 'Eiffel Tower', 'Eiffel Towers', 'On the hottest summer days the Eiffel Tower can grow roughly 12–15 cm taller.']
  ];
  function funCard(total) {
    if (!(total > 0)) return '';
    let i = 0; OBJ.forEach((o, k) => { if (total >= o[0]) i = k; });
    const o = OBJ[i], nx = OBJ[i + 1], n = total / o[0], full = Math.min(10, Math.floor(n));
    const em = n >= 10 ? `${o[1]} <span class="text-xl font-extrabold text-white">× ${Math.round(n)}</span>`
      : o[1].repeat(full) + ((n - Math.floor(n) >= 0.25 || !full) ? `<span style="opacity:.35">${o[1]}</span>` : '');
    const cnt = n >= 10 ? Math.round(n) : f1(n), pct = nx ? Math.min(100, Math.round(total / nx[0] * 100)) : 100;
    return `<div class="rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-3 mt-3 text-center">
      <div class="${SUB} mb-1">That is about the weight of…</div>
      <div class="text-3xl leading-tight mb-1 break-all">${em}</div>
      <div class="text-sm font-bold text-white">≈ ${cnt} ${Math.abs(n - 1) < 0.05 ? o[2] : o[3]}</div>
      <div class="text-[11px] text-slate-400">each ≈ ${Math.round(disp(o[0])).toLocaleString()} ${P.unit}</div>
      <p class="text-xs text-indigo-200 mt-2">💡 ${o[4]}</p>
      ${nx ? `<div class="mt-2 text-left"><div class="flex justify-between text-[10px] text-slate-400"><span>Next up: ${nx[1]} ${nx[2]}</span><span>${pct}%</span></div><div class="h-1.5 bg-slate-900/70 rounded-full"><div class="h-1.5 rounded-full bg-amber-400" style="width:${pct}%"></div></div></div>` : ''}</div>`;
  }

  // 7-day cycles count back from the end of the viewed period; weeks are Sun–Sat.
  function volBuckets() {
    const end = iso(new Date(range ? win()[1] : todayMs())), dates = EX().map(e => e.date).sort();
    const min = range ? iso(new Date(win()[0])) : (dates[0] || end), bk = [];
    let s, e;
    if (vmode === 'week') { const d = new Date(tms(end)); d.setDate(d.getDate() - d.getDay()); s = iso(d); e = addD(s, 6); } else { e = end; s = addD(end, -6); }
    for (let j = 0; j < 26; j++) { bk.unshift({ s, e }); if (s <= min) break; s = addD(s, -7); e = addD(e, -7); }
    bk.forEach(b => { b.ents = EX().filter(x => x.date >= b.s && x.date <= b.e); b.total = b.ents.reduce((a, x) => a + vol(x), 0); b.sess = new Set(b.ents.map(x => x.date)).size; });
    return bk;
  }

  function volumeBody() {
    const bk = volBuckets(), si = (vsel >= 0 && vsel < bk.length) ? vsel : bk.length - 1, cur = bk[si], prev = bk[si - 1];
    const lab = vmode === 'week' ? 'week' : '7-day cycle', fmt = v => Math.round(disp(v)).toLocaleString() + ' ' + P.unit;
    const items = bk.map(b => ({ y: disp(b.total), lab: fd(b.s), l: `${fd(b.s)} – ${fd(b.e)}: ${fmt(b.total)}` }));
    const per = {}; cur.ents.forEach(e => { const n = (e.name || '').trim(); per[n] = (per[n] || 0) + vol(e); });
    const top = Object.entries(per).sort((a, c) => c[1] - a[1]).slice(0, 6), mx = top.length ? top[0][1] : 1;
    let cmp = `<span class="text-slate-400">No earlier ${lab} to compare</span>`;
    if (prev && prev.total > 0) { const p = (cur.total - prev.total) / prev.total * 100; cmp = `<span class="${p >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold">${p >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(p))}%</span> <span class="text-slate-400">vs previous ${lab} (${big(disp(prev.total))} ${P.unit})</span>`; }
    else if (prev) cmp = `<span class="text-slate-400">Previous ${lab} had no volume</span>`;
    const pill = (m, t) => `<button onclick="PG.volMode('${m}')" class="flex-1 text-[11px] font-bold py-1.5 rounded-lg ${vmode === m ? 'bg-indigo-600 text-white' : 'bg-slate-900/70 text-slate-300'}">${t}</button>`;
    const st = (a, b) => `<div><div class="text-lg font-extrabold text-white">${a}</div><div class="text-[10px] text-slate-400">${b}</div></div>`;
    return `<div class="flex gap-1 mb-3">${pill('cycle', '7-day cycles')}${pill('week', 'Calendar weeks')}</div>
      <div class="text-xs text-slate-300 text-center">${fd(cur.s)} – ${fd(cur.e)}</div>
      <div class="grid grid-cols-3 gap-2 my-2 text-center">${st(big(disp(cur.total)), 'total ' + P.unit)}${st(cur.sess, 'sessions')}${st(cur.sess ? big(disp(cur.total / cur.sess)) : '--', P.unit + ' / session')}</div>
      <div class="text-xs text-center mb-2">${cmp}</div>
      <p class="text-[11px] text-slate-400 mb-1">Volume = sets × reps × load (bodyweight lifts include body weight)</p>
      ${bars('v', items, 0, '#6366f1', si)}<div class="text-[11px] text-indigo-300 text-center min-h-[16px]">Tap a bar to select a ${lab}</div>
      ${funCard(cur.total)}
      ${top.length ? `<div class="mt-3"><div class="${SUB} mb-1">Volume by lift</div>${top.map(t => `<div class="mb-1.5"><div class="flex justify-between text-xs text-slate-300"><span>${esc(t[0])}</span><span class="font-semibold">${big(disp(t[1]))} ${P.unit}</span></div><div class="h-1.5 bg-slate-900/70 rounded-full"><div class="h-1.5 rounded-full bg-indigo-500" style="width:${Math.max(3, t[1] / mx * 100)}%"></div></div></div>`).join('')}</div>` : ''}`;
  }

  function macroBody() {
    const logged = Object.keys(FL()).filter(k => (FL()[k] || []).length && inWin(k)).sort(), G = GL();
    if (!logged.length) return '<p class="text-xs text-slate-500 py-6 text-center">No food logged in this period.</p>';
    const tot = k => FL()[k].reduce((a, i) => ({ cal: a.cal + (+i.cal || 0), p: a.p + (+i.p || 0), c: a.c + (+i.c || 0), f: a.f + (+i.f || 0) }), { cal: 0, p: 0, c: 0, f: 0 });
    const T = {}; logged.forEach(k => T[k] = tot(k));
    const g = {}; logged.forEach(k => { (g[keyOf(k)] = g[keyOf(k)] || []).push(T[k].cal); });
    const items = Object.keys(g).sort().map(k => { const a = g[k].reduce((s, v) => s + v, 0) / g[k].length; return { y: a, lab: fd(k), l: `${daily() ? '' : 'Week of '}${fd(k)}: ${Math.round(a)} kcal${daily() ? '' : ' avg/day'}` }; });
    const avg = f => logged.reduce((s, k) => s + T[k][f], 0) / logged.length;
    const onT = G.cal ? logged.filter(k => Math.abs(T[k].cal - G.cal) <= G.cal * 0.1).length : 0;
    const row = (l, f, c) => { const a = avg(f), gv = G[f], pc = gv ? Math.min(100, a / gv * 100) : 0; return `<div class="mb-1.5"><div class="flex justify-between text-xs text-slate-300"><span>${l}</span><span class="font-semibold">${Math.round(a)}${f === 'cal' ? ' kcal' : 'g'}${gv ? ` <span class="text-slate-500 font-normal">/ ${gv}</span>` : ''}</span></div><div class="h-1.5 bg-slate-900/70 rounded-full"><div class="h-1.5 rounded-full" style="width:${pc}%;background:${c}"></div></div></div>`; };
    return `<div class="grid grid-cols-2 gap-2 mb-2 text-center"><div><div class="text-lg font-extrabold text-white">${logged.length}</div><div class="text-[10px] text-slate-400">days logged</div></div><div><div class="text-lg font-extrabold text-white">${G.cal ? onT + '/' + logged.length : '--'}</div><div class="text-[10px] text-slate-400">days within 10% of goal</div></div></div>
      <p class="text-[11px] text-slate-400 mb-1">Calories ${daily() ? 'per day' : 'avg per day, by week'} · dashed line = goal</p>
      ${bars('m', items, G.cal, '#10b981')}${cap('m')}
      <div class="mt-2"><div class="${SUB} mb-1">Daily average vs goal</div>${row('Calories', 'cal', '#10b981')}${row('Protein', 'p', '#6366f1')}${row('Carbs', 'c', '#f59e0b')}${row('Fat', 'f', '#f43f5e')}</div>`;
  }

  function monthBody() {
    const { L, F } = activity(), n = new Date(), m = new Date(n.getFullYear(), n.getMonth() + moff, 1), ym = iso(m).slice(0, 7);
    const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), tod = iso(n);
    let cells = '<div class="text-[10px] text-slate-500 text-center">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].join('</div><div class="text-[10px] text-slate-500 text-center">') + '</div>';
    for (let i = 0; i < m.getDay(); i++) cells += '<div></div>';
    let ld = 0, fdays = 0, v = 0;
    for (let d = 1; d <= dim; d++) {
      const k = ym + '-' + String(d).padStart(2, '0'), l = L.has(k), f = F.has(k);
      if (l) ld++; if (f) fdays++;
      const bg = k > tod ? 'transparent' : l && f ? '#a78bfa' : l ? '#4f46e5' : f ? '#065f46' : '#1e293b';
      cells += `<button onclick="PG.day('${k}')" class="aspect-square rounded-lg text-[11px] font-semibold ${k > tod ? 'text-slate-600' : 'text-white'} ${k === tod ? 'ring-1 ring-amber-300' : ''}" style="background:${bg}">${d}</button>`;
    }
    EX().forEach(e => { if (e.date.slice(0, 7) === ym) v += vol(e); });
    const st = (a, b) => `<div class="text-center"><div class="text-lg font-extrabold text-white">${a}</div><div class="text-[10px] text-slate-400">${b}</div></div>`;
    return `<div class="flex items-center justify-between mb-2"><button onclick="PG.mon(-1)" class="px-3 py-1 text-slate-200 font-bold">◀</button><span class="text-xs font-semibold text-slate-200">${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span><button onclick="PG.mon(1)" class="px-3 py-1 font-bold ${moff ? 'text-slate-200' : 'text-slate-600'}">▶</button></div>
      <div class="grid grid-cols-7 gap-1">${cells}</div>
      <div class="flex flex-wrap gap-x-3 text-[10px] text-slate-400 mt-2"><span><span style="color:#4f46e5">■</span> lifted</span><span><span style="color:#065f46">■</span> food logged</span><span><span style="color:#a78bfa">■</span> both</span></div>
      ${cap('c', 'Tap a day for details')}
      <div class="grid grid-cols-4 gap-2 mt-2">${st(ld, 'lifting days')}${st(f1(ld / (dim / 7)), 'per week')}${st(fdays, 'food days')}${st(big(disp(v)), P.unit + ' lifted')}</div>`;
  }

  function render() {
    const el = $('progressTab'); if (!el) return;
    const keep = document.activeElement && document.activeElement.id === 'pgQ';
    el.innerHTML = `<div class="flex items-center justify-between gap-2">
        <div class="flex gap-1 bg-slate-800/80 p-1 rounded-xl">${RANGES.map(r => `<button onclick="PG.range(${r[0]})" class="text-[11px] font-bold px-2 py-1.5 rounded-lg ${r[0] === range ? 'bg-indigo-600 text-white' : 'text-slate-300'}">${r[1]}</button>`).join('')}</div>
        <button onclick="PG.unit()" class="text-[11px] font-bold px-3 py-2 rounded-xl bg-slate-800/80 text-slate-200 border border-slate-700/50">${P.unit.toUpperCase()}</button></div>
      ${range ? `<div class="flex items-center justify-between bg-slate-800/60 rounded-xl px-1 py-1"><button onclick="PG.nav(-1)" class="px-4 py-1.5 text-slate-200 font-bold" aria-label="Earlier">◀</button><span class="text-xs font-semibold text-slate-200">${winLabel()}</span><button onclick="PG.nav(1)" class="px-4 py-1.5 font-bold ${off ? 'text-slate-200' : 'text-slate-600'}" aria-label="Later">▶</button></div>` : ''}
      ${summary()}${sec('body', 'Body composition', '', bodyBody)}${sec('strength', 'Strength', '1RM records', strengthBody)}${sec('volume', 'Lifted volume', '', volumeBody)}${sec('macros', 'Macros', '', macroBody)}${sec('month', 'Consistency', 'by month', monthBody)}`;
    if (keep) { const i = $('pgQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }

  // ---------- actions ----------
  window.PG = {
    render,
    range(n) { range = n; off = 0; vsel = -1; render(); },
    volMode(m) { vmode = m; vsel = -1; render(); },
    nav(d) { off = Math.min(0, off + d); vsel = -1; render(); },
    mon(d) { moff = Math.min(0, moff + d); render(); },
    unit() { P.unit = P.unit === 'kg' ? 'lb' : 'kg'; save(); render(); },
    tog(id) { P.open[id] = P.open[id] === false; save(); render(); },
    metric(k) { wm = k; render(); },
    search(v) { q = v; render(); },
    setLift(i) { if (shown[i]) sel = shown[i].name.toLowerCase(); render(); },
    addW() {
      // 0 or blank = "not measured". Each field is range-checked in the unit currently shown.
      const num = id => { const v = parseFloat($(id) && $(id).value); return isNaN(v) || v <= 0 ? null : v; };
      const k = P.unit === 'lb' ? 1 / LB : 1, d = ($('pgD') && $('pgD').value) || iso(new Date());
      const raw = { kg: num('pgW'), bf: num('pgB'), mm: num('pgM') }, out = {};
      const fields = [['kg', 'Weight', 20, 400, true], ['bf', 'Body fat', 2, 60, false], ['mm', 'Muscle mass', 10, 200, true]];
      for (const [f, name, lo, hi, mass] of fields) {
        if (raw[f] == null) continue;
        const v = mass ? raw[f] * k : raw[f];
        if (!(v >= lo && v <= hi)) {
          const u = mass ? P.unit : '%', a = mass ? Math.ceil(disp(lo)) : lo, z = mass ? Math.floor(disp(hi)) : hi;
          toast(`${name} ${raw[f]}${u} is outside ${a}–${z}${u}`); return;
        }
        out[f] = v;
      }
      if (!Object.keys(out).length) { toast('Enter at least one value'); return; }
      const cur = P.weights.find(w => w.date === d) || { date: d };
      if (out.kg != null) cur.kg = Math.round(out.kg * 100) / 100;
      if (out.bf != null) cur.bf = Math.round(out.bf * 10) / 10;
      if (out.mm != null) cur.mm = Math.round(out.mm * 100) / 100;
      P.weights = P.weights.filter(w => w.date !== d).concat(cur); save(); render(); toast('Entry saved');
    },
    delW(d) { P.weights = P.weights.filter(w => w.date !== d); save(); render(); },
    tap(id, e) {
      const r = e.currentTarget.getBoundingClientRect(), f = (e.clientX - r.left) / r.width; let b = null;
      (TIPS[id] || []).forEach(p => { if (!b || Math.abs(p.px - f) < Math.abs(b.px - f)) b = p; });
      if (id === 'v' && b) { vsel = b.i; render(); return; }
      const c = $('cap-' + id); if (b && c) c.textContent = b.l;
    },
    day(k) {
      const n = EX().filter(e => e.date === k), f = (FL()[k] || []).length, c = $('cap-c');
      if (c) c.textContent = `${k}: ${n.length ? n.map(e => e.name).join(', ') : 'no lifting'}${f ? ' · ' + f + ' food items' : ''}`;
    }
  };

  // Hook for csv-io.js (same pattern as window.rehabData).
  window.progressData = {
    get: () => P.weights.map(w => Object.assign({}, w)),
    set: arr => { P.weights = arr.map(w => Object.assign({}, w)); save(); render(); }
  };

  // ---------- install: nav button + tab container + switchTab wrapper ----------
  function install() {
    const settings = $('settingsTab'), sb = $('tabBtnSettings');
    if ($('progressTab') || !settings || !sb) return;
    const tab = document.createElement('div'); tab.id = 'progressTab'; tab.className = 'hidden space-y-5';
    settings.parentNode.insertBefore(tab, settings);
    const base = 'col-span-2 w-full py-2.5 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ';
    const off0 = base + 'text-slate-300 hover:text-white', on = base + 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20';
    const btn = document.createElement('button'); btn.id = 'tabBtnProgress'; btn.className = off0;
    btn.innerHTML = '<i class="fa-solid fa-chart-line"></i><span class="truncate">Progress</span>';
    btn.onclick = () => window.switchTab('progress');
    sb.parentNode.insertBefore(btn, sb);
    const orig = window.switchTab;
    window.switchTab = function (name) {
      orig.apply(this, arguments);
      const active = name === 'progress';
      if (active) tab.classList.remove('hidden'); else tab.classList.add('hidden');
      btn.className = active ? on : off0;
      sb.className = sb.className.replace('col-span-3', 'col-span-1');
      if (active) render();
    };
    sb.className = sb.className.replace('col-span-3', 'col-span-1');
  }
  install();
})();