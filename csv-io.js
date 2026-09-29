// =====================================================================
// csv-io.js — CSV import/export for Lifting Log, Macro Tracker, Rehab.
// Load AFTER lifting-log.js, macro-tracker.js and rehab.js.
// Reads/writes the other modules' top-level `exercises` / `foodLogs`
// directly (classic scripts share global scope) and uses
// window.rehabData (added to rehab.js) for the rehab closure state.
// Imports OVERWRITE existing data for that module (after a confirm prompt).
// If the file contains no valid rows, nothing is changed.
// =====================================================================
(function () {
  'use strict';

  // ---------- generic CSV helpers ----------
  const cell = v => {
    v = v == null ? '' : String(v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  // `hints` adds a reference note to a column header, e.g. { date: 'YYYY-MM-DD' } -> "date (YYYY-MM-DD)".
  // parseCSV strips these notes again on import, so both plain and annotated headers work.
  const toCSV = (cols, rows, hints = {}) =>
    [cols.map(c => cell(hints[c] ? `${c} (${hints[c]})` : c)).join(','),
     ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
  const DATE_HINT = { date: 'YYYY-MM-DD' };

  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = ''; rows.push(row); row = [];
      } else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    const clean = rows.filter(r => r.some(c => c !== ''));
    if (!clean.length) return [];
    const head = clean[0].map(h => h.trim().replace(/\s*\(.*\)\s*$/, ''));
    return clean.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }

  function download(filename, csv) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function pickFile(onText) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onText(String(reader.result));
      reader.readAsText(file);
    };
    input.click();
  }

  const stamp = () => new Date().toISOString().slice(0, 10);
  const num = (v, d = 0) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  const idOf = v => (v !== '' && !isNaN(Number(v)) ? Number(v) : v);
  const toast = m => (typeof showToast === 'function' ? showToast(m) : alert(m));
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
  // Accepts YYYY-MM-DD plus what Excel tends to save: 29-09-26, 29/09/2026, 2026/9/29, etc.
  // Day-first unless the numbers make month-first the only valid reading. Returns '' if invalid.
  function normDate(v) {
    v = String(v == null ? '' : v).trim();
    if (isDate(v)) return v;
    let y, m, d, a;
    if ((a = v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) { y = +a[1]; m = +a[2]; d = +a[3]; }
    else if ((a = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/))) {
      d = +a[1]; m = +a[2]; y = +a[3];
      if (m > 12 && d <= 12) { const t = d; d = m; m = t; }
      if (a[3].length === 2) y += 2000;
    } else return '';
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const confirmReplace = (label, count) =>
    confirm(`Replace ALL existing ${label} with ${count} imported record(s)? This cannot be undone.`);

  // ---------- Lifting Log ----------
  const LIFT_COLS = ['id', 'date', 'name', 'weight', 'unit', 'sets', 'reps', 'tempo', 'isBW'];

  function exportLifting() {
    download(`lifting-log-${stamp()}.csv`, toCSV(LIFT_COLS, exercises, DATE_HINT));
  }

  function importLifting(text) {
    const seen = new Set();
    const incoming = [];
    let skipped = 0, reassigned = 0, nextId = 1;
    const rows = parseCSV(text);
    // Reserve every id typed in the file so auto-generated ones never collide with them.
    const used = new Set();
    rows.forEach(r => {
      const raw = String(r.id || '').trim();
      if (raw === '') return;
      used.add(String(idOf(raw)));
      const n = Number(raw);
      if (n >= nextId) nextId = Math.floor(n) + 1;
    });
    const newId = () => {
      while (used.has(String(nextId))) nextId++;
      used.add(String(nextId));
      return nextId++;
    };
    rows.forEach(r => {
      r.date = normDate(r.date);
      if (!r.name || !isDate(r.date)) { skipped++; return; }
      const raw = String(r.id || '').trim();
      let id = raw === '' ? newId() : idOf(raw);
      if (seen.has(String(id))) { id = newId(); reassigned++; }
      seen.add(String(id));
      incoming.push({
        id, name: r.name.trim(), date: r.date,
        weight: num(r.weight), unit: r.unit === 'lb' ? 'lb' : 'kg',
        sets: Math.round(num(r.sets, 1)), reps: Math.round(num(r.reps, 1)),
        tempo: typeof formatTempo === 'function' ? formatTempo(r.tempo) : (r.tempo || '2-0-1-0'),
        isBW: /^(true|1|yes)$/i.test(r.isBW)
      });
    });
    if (!incoming.length) return toast('Lifting: no valid rows found — nothing changed');
    if (!confirmReplace('lifting log entries', incoming.length)) return;
    exercises = incoming;
    if (typeof saveLifting === 'function') saveLifting();
    if (typeof renderExercises === 'function') renderExercises();
    if (typeof render1RMCard === 'function') render1RMCard();
    if (typeof updateSuggestionsSelect === 'function') updateSuggestionsSelect();
    toast(`Lifting: replaced with ${incoming.length} records`
      + (reassigned ? `, ${reassigned} duplicate id(s) renumbered` : '')
      + (skipped ? `, ${skipped} skipped` : ''));
  }

  // ---------- Macro Tracker (food logs) ----------
  const FOOD_COLS = ['date', 'id', 'name', 'cal', 'p', 'c', 'f', 'portion', 'baseCal', 'baseP', 'baseC', 'baseF'];

  function exportFood() {
    const rows = [];
    Object.keys(foodLogs).sort().forEach(date =>
      (foodLogs[date] || []).forEach(e => rows.push(Object.assign({}, e, { date }))));
    download(`food-log-${stamp()}.csv`, toCSV(FOOD_COLS, rows, DATE_HINT));
  }

  function importFood(text) {
    const incoming = {};
    let count = 0, skipped = 0, reassigned = 0;
    const genId = () => Date.now() + Math.floor(Math.random() * 1e6);
    parseCSV(text).forEach(r => {
      r.date = normDate(r.date);
      if (!r.name || !isDate(r.date)) { skipped++; return; }
      const day = (incoming[r.date] = incoming[r.date] || []);
      const taken = i => day.some(e => String(e.id) === String(i));
      const raw = String(r.id || '').trim();
      let id = raw === '' ? genId() : idOf(raw);
      if (taken(id)) {
        do { id = genId(); } while (taken(id));
        reassigned++;
      }
      const entry = { id, name: r.name, cal: num(r.cal), p: num(r.p), c: num(r.c), f: num(r.f), portion: num(r.portion, 1) };
      ['baseCal', 'baseP', 'baseC', 'baseF'].forEach(k => { if (r[k] !== '') entry[k] = num(r[k]); });
      day.push(entry);
      count++;
    });
    if (!count) return toast('Food log: no valid rows found — nothing changed');
    if (!confirmReplace('food log entries', count)) return;
    foodLogs = incoming;
    localStorage.setItem('apex_food_logs', JSON.stringify(foodLogs));
    if (typeof renderDay === 'function') renderDay();
    toast(`Food log: replaced with ${count} entries`
      + (reassigned ? `, ${reassigned} duplicate id(s) renumbered` : '')
      + (skipped ? `, ${skipped} skipped` : ''));
  }

  // ---------- Rehab (exercises + routines + schedule in one file) ----------
  // One flat file with a `type` column. Photos (img) are NOT exported — they're
  // base64 blobs that would make the CSV enormous.
  const REHAB_COLS = ['type', 'id', 'name', 'group', 'sets', 'reps', 'unit', 'rest', 'also', 'desc', 'video', 'data'];

  function exportRehab() {
    if (!window.rehabData) return toast('Rehab module not ready');
    const d = window.rehabData.get();
    const rows = [];
    d.exercises.forEach(e => rows.push({
      type: 'exercise', id: e.id, name: e.name, group: e.group, sets: e.sets, reps: e.reps,
      unit: e.unit, rest: e.rest, also: (e.also || []).join(';'), desc: e.desc, video: e.video
    }));
    d.routines.forEach(r => rows.push({ type: 'routine', id: r.id, name: r.name, data: JSON.stringify(r.items) }));
    Object.keys(d.sched).forEach(day => rows.push({ type: 'schedule', id: day, data: JSON.stringify(d.sched[day]) }));
    download(`rehab-${stamp()}.csv`, toCSV(REHAB_COLS, rows));
  }

  function importRehab(text) {
    if (!window.rehabData) return toast('Rehab module not ready');
    const out = { exercises: [], routines: [], sched: {} };
    let bad = 0;
    parseCSV(text).forEach(r => {
      try {
        if (r.type === 'exercise' && r.id && r.name) {
          out.exercises.push({
            id: r.id, name: r.name, group: r.group, sets: num(r.sets, 1), reps: num(r.reps, 1),
            unit: r.unit === 's' ? 's' : 'r', rest: num(r.rest), also: r.also ? r.also.split(';').filter(Boolean) : [],
            desc: r.desc, video: r.video
          });
        } else if (r.type === 'routine' && r.id && r.name) {
          const items = JSON.parse(r.data || '[]');
          if (!Array.isArray(items)) throw new Error('items');
          out.routines.push({ id: r.id, name: r.name, items });
        } else if (r.type === 'schedule' && r.id) {
          const ids = JSON.parse(r.data || '[]');
          if (!Array.isArray(ids)) throw new Error('sched');
          out.sched[r.id] = ids;
        } else bad++;
      } catch (e) { bad++; }
    });
    if (!out.exercises.length && !out.routines.length && !Object.keys(out.sched).length)
      return toast('Rehab: no valid rows found — nothing changed');
    if (!confirmReplace('rehab exercises, routines and schedule', out.exercises.length + out.routines.length)) return;
    window.rehabData.replace(out);
    toast(`Rehab: replaced with ${out.exercises.length} exercises, ${out.routines.length} routines` + (bad ? `, ${bad} bad rows` : ''));
  }

  // ---------- public API used by the buttons in index.html ----------
  window.csvIO = {
    exportLifting, exportFood, exportRehab,
    importLifting: () => pickFile(importLifting),
    importFood: () => pickFile(importFood),
    importRehab: () => pickFile(importRehab)
  };
  
})();