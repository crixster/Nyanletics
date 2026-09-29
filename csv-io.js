// =====================================================================
// csv-io.js — CSV import/export for Lifting Log, Macro Tracker, Rehab.
// Load AFTER lifting-log.js, macro-tracker.js and rehab.js.
// Reads/writes the other modules' top-level `exercises` / `foodLogs`
// directly (classic scripts share global scope) and uses
// window.rehabData (added to rehab.js) for the rehab closure state.
// Rehab export can also bundle photos in a .zip (see Rehab section).
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

  function downloadBlob(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const download = (filename, csv) =>
    downloadBlob(filename, new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));

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

  function pickAny(accept, onFile) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => { const f = input.files && input.files[0]; if (f) onFile(f); };
    input.click();
  }

  // ---------- tiny ZIP writer/reader (no library) ----------
  // Writer stores files uncompressed (JPEGs are already compressed). Reader also handles
  // deflate-compressed zips (e.g. re-zipped by Windows/macOS) via the browser's DecompressionStream.
  const CRC_T = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xEDB88320 ^ (x >>> 1) : x >>> 1; t[n] = x >>> 0; }
    return t;
  })();
  const crc32 = b => { let x = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) x = CRC_T[(x ^ b[i]) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };

  function zipStore(files) {               // files: [{ name, data: Uint8Array }]  ->  Blob
    const enc = new TextEncoder(), now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [], central = [];
    let off = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + size;
    });
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  async function readZip(buf) {            // ArrayBuffer -> { name: Uint8Array }
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--)
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + el + cl;
      if (name.endsWith('/')) continue;
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const raw = u8.subarray(start, start + csize);
      if (method === 0) out[name] = raw.slice();
      else if (method === 8) out[name] = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else throw new Error('unsupported zip method ' + method);
    }
    return out;
  }

  // ---------- photo <-> file helpers ----------
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  function dataUrlToBytes(u) {
    const i = String(u).indexOf(',');
    if (!/^data:image\//.test(u) || i < 0) return null;
    const bin = atob(u.slice(i + 1)), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return { mime: u.slice(5, i).split(';')[0], bytes };
  }
  function bytesToDataUrl(bytes, mime) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${mime};base64,${btoa(s)}`;
  }
  const baseName = p => String(p || '').split(/[\\/]/).pop().toLowerCase();
  const slug = s => String(s || 'exercise').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'exercise';

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
  // Yes/No dialog — the browser's confirm() can't rename its OK/Cancel buttons.
  // Esc or a tap outside the box counts as "No".
  function askYesNo(title, body, yesLabel = 'Yes', noLabel = 'No') {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.75);display:flex;align-items:center;justify-content:center;padding:16px;';
      const box = document.createElement('div');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.style.cssText = 'width:100%;max-width:360px;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:16px;color:#e2e8f0;font-family:inherit;box-shadow:0 20px 50px rgba(0,0,0,.5);';
      const h = document.createElement('div');
      h.textContent = title;
      h.style.cssText = 'font-weight:700;font-size:15px;margin-bottom:6px;';
      const p = document.createElement('div');
      p.textContent = body;
      p.style.cssText = 'font-size:12px;color:#94a3b8;white-space:pre-line;margin-bottom:14px;';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;';
      const onKey = e => { if (e.key === 'Escape') done(false); };
      const done = v => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); };
      const mk = (label, primary, val) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = `flex:1;padding:9px 10px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:#fff;border:1px solid ${primary ? '#4f46e5' : '#475569'};background:${primary ? '#4f46e5' : '#1e293b'};`;
        b.onclick = () => done(val);
        return b;
      };
      const yes = mk(yesLabel, true, true), no = mk(noLabel, false, false);
      row.append(no, yes);
      box.append(h, p, row);
      wrap.appendChild(box);
      wrap.addEventListener('click', e => { if (e.target === wrap) done(false); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      yes.focus();
    });
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
  // One flat file with a `type` column. Photos are base64 blobs — far too big for a CSV cell
  // (Excel caps a cell at ~32k chars) — so when photos are exported they travel as real image files:
  //   rehab-YYYY-MM-DD.zip  ->  rehab.csv + images/001-exercise-name.jpg ...
  // and the `img` column holds each photo's file path. Importing a plain .csv leaves your existing photos alone.
  const REHAB_COLS = ['type', 'id', 'name', 'group', 'sets', 'reps', 'unit', 'rest', 'also', 'desc', 'video', 'img', 'data'];

  async function exportRehab() {
    if (!window.rehabData) return toast('Rehab module not ready');
    const d = window.rehabData.get();
    const zipIt = d.exercises.some(e => e.img) &&
      await askYesNo('Include exercise photos?', 'Yes = .zip (CSV + photo files)\nNo = plain .csv only (no photos)');
    const files = [], rows = [];
    d.exercises.forEach((e, i) => {
      let img = '';
      if (zipIt && e.img) {
        const p = dataUrlToBytes(e.img);
        if (p) {
          img = `images/${String(i + 1).padStart(3, '0')}-${slug(e.name)}.${EXT[p.mime] || 'jpg'}`;
          files.push({ name: img, data: p.bytes });
        }
      }
      rows.push({
        type: 'exercise', id: e.id, name: e.name, group: e.group, sets: e.sets, reps: e.reps,
        unit: e.unit, rest: e.rest, also: (e.also || []).join(';'), desc: e.desc, video: e.video, img
      });
    });
    d.routines.forEach(r => rows.push({ type: 'routine', id: r.id, name: r.name, data: JSON.stringify((r.items || []).map(({ img, ...rest }) => rest)) }));
    Object.keys(d.sched).forEach(day => rows.push({ type: 'schedule', id: day, data: JSON.stringify(d.sched[day]) }));
    const csv = toCSV(REHAB_COLS, rows);
    if (!zipIt) return download(`rehab-${stamp()}.csv`, csv);
    files.unshift({ name: 'rehab.csv', data: new TextEncoder().encode('\uFEFF' + csv) });
    downloadBlob(`rehab-${stamp()}.zip`, zipStore(files));
    toast(`Rehab: exported ${files.length - 1} photo(s) in a zip`);
  }

  function importRehab(text, images) {
    if (!window.rehabData) return toast('Rehab module not ready');
    const out = { exercises: [], routines: [], sched: {} };
    let bad = 0, photos = 0;
    parseCSV(text).forEach(r => {
      try {
        if (r.type === 'exercise' && r.name) {
          const id = (r.id || '').trim() || r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const img = (images && r.img && images[baseName(r.img)]) || '';
          if (img) photos++;
          out.exercises.push({
            id, name: r.name, group: r.group, sets: num(r.sets, 1), reps: num(r.reps, 1),
            unit: r.unit === 's' ? 's' : 'r', rest: num(r.rest), also: r.also ? r.also.split(';').filter(Boolean) : [],
            desc: r.desc, video: r.video, img
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
    toast(`Rehab: replaced with ${out.exercises.length} exercises, ${out.routines.length} routines`
      + (photos ? `, ${photos} photos restored` : '') + (bad ? `, ${bad} bad rows` : ''));
  }

  // Accepts either the plain .csv or the .zip made by exportRehab
  async function importRehabFile(file) {
    if (!/\.zip$/i.test(file.name)) return importRehab(await file.text());
    try {
      const entries = await readZip(await file.arrayBuffer());
      const names = Object.keys(entries).filter(n => !/(^|\/)(__MACOSX|\._)/.test(n));
      const csvName = names.find(n => /\.csv$/i.test(n));
      if (!csvName) return toast('Rehab: no .csv found inside that zip');
      const images = {};
      names.forEach(n => {
        const m = /\.(jpe?g|png|webp|gif)$/i.exec(n);
        if (m) images[baseName(n)] = bytesToDataUrl(entries[n], MIME[m[1].toLowerCase()]);
      });
      importRehab(new TextDecoder().decode(entries[csvName]), images);
    } catch (e) { console.warn('rehab zip import failed', e); toast('Rehab: could not read that zip file'); }
  }

  // ---------- public API used by the buttons in index.html ----------
  window.csvIO = {
    exportLifting, exportFood, exportRehab,
    importLifting: () => pickFile(importLifting),
    importFood: () => pickFile(importFood),
    importRehab: () => pickAny('.csv,.zip,text/csv,application/zip', importRehabFile)
  };
  
})();