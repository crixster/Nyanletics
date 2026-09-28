// =====================================================================
// rehab.js — Nyanletics: Rehab & Recovery tab
// Owns: body map, suggested-exercise library (editable), custom workout
//       builder, saved routines, weekly schedule.
// Renders itself into <div id="rehabTab"> — index.html only needs that
// empty div. core.js already calls initRehabUI / renderCharacterView /
// renderLegend / renderPicker / renderWorkout / renderSchedule.
// localStorage keys: apex_rehab_exercises, _routines, _schedule, _draft
// =====================================================================
(function () {
  'use strict';

  // ---------- Muscle groups: id, label, hue ----------
  const GROUPS = [
    ['neck', 'Neck', 200], ['traps', 'Traps', 265], ['shoulders', 'Shoulders', 35],
    ['chest', 'Chest', 0], ['biceps', 'Biceps', 48], ['triceps', 'Triceps', 28],
    ['forearms', 'Forearms', 170], ['abs', 'Abs', 140], ['obliques', 'Obliques', 185],
    ['lats', 'Lats', 120], ['lowback', 'Lower Back', 290], ['glutes', 'Glutes', 320],
    ['hips', 'Hips', 80], ['quads', 'Quads', 10], ['hamstrings', 'Hamstrings', 345],
    ['calves', 'Calves', 215], ['shins', 'Shins', 95], ['feet', 'Feet & Ankles', 240]
  ];
  const LABEL = {}, HUE = {};
  GROUPS.forEach(g => { LABEL[g[0]] = g[1]; HUE[g[0]] = g[2]; });
  const color = g => `hsl(${HUE[g]} 65% 58%)`;

  // ---------- Body map shapes (left half, figure centred on x=0; mirrored) ----------
  const CENTRAL = new Set(['neck', 'traps', 'abs', 'lowback']);
  const SH = {
    neck:      { f: 'M-8 42L8 42L10 58L-10 58Z' },
    traps:     { b: 'M0 42L9 44L22 58L38 68L22 88L0 114L-22 88L-38 68L-22 58L-9 44Z' },
    shoulders: { f: 'M-16 60Q-34 58-44 72Q-49 88-43 96L-29 92L-22 70Z', b: 'M-16 60Q-34 58-44 72Q-49 88-43 96L-29 92L-22 70Z' },
    chest:     { f: 'M-2 64L-20 64Q-30 66-30 80Q-28 96-14 100L-2 98Z' },
    biceps:    { f: 'M-44 96L-30 94L-32 134L-46 134Z' },
    triceps:   { b: 'M-44 96L-30 94L-32 134L-46 134Z' },
    forearms:  { f: 'M-47 136L-33 136L-38 184L-52 184Z', b: 'M-47 136L-33 136L-38 184L-52 184Z' },
    abs:       { f: 'M-11 102L11 102L10 166L-10 166Z' },
    obliques:  { f: 'M-29 100L-13 102L-11 160L-24 152Q-31 128-29 100Z' },
    lats:      { b: 'M-31 84L-19 88L-3 114L-15 140L-24 140Q-33 120-31 84Z' },
    lowback:   { b: 'M-15 142L15 142L14 172L-14 172Z' },
    glutes:    { b: 'M-30 174L0 174L0 208Q-14 220-29 208Z' },
    hips:      { f: 'M-26 154L-11 164L-3 178L-28 178L-30 166Z' },
    quads:     { f: 'M-30 180L-3 180L-6 262Q-10 272-18 272L-27 262Q-34 220-30 180Z' },
    hamstrings:{ b: 'M-30 210L-2 210L-6 262L-28 262Q-32 240-30 210Z' },
    shins:     { f: 'M-27 276L-9 276L-12 348L-22 348Z' },
    calves:    { b: 'M-28 276L-8 276L-11 332L-24 332Z' },
    feet:      { f: 'M-23 350L-11 350L-8 366Q-8 378-16 380L-30 380Q-30 366-23 350Z',
                 b: 'M-23 336L-11 336L-9 366Q-9 378-16 380L-30 380Q-30 366-24 336Z' }
  };
  const Z = ['lats','lowback','hamstrings','glutes','abs','obliques','hips','chest','quads','traps',
             'neck','biceps','triceps','forearms','shins','calves','feet','shoulders'];

  // ---------- Suggested exercises: group|name|sets|reps|unit(r=reps,s=hold secs)|rest ----------
  const DEFAULTS = `
neck|Chin Tucks|2|10|r|20
neck|Upper Trap / Neck Side Stretch|2|30|s|10
neck|Isometric Neck Hold (hand resist)|3|10|s|20
traps|Shoulder Shrug & Hold|3|10|r|30
traps|Upper Trap Stretch|2|30|s|10
traps|Lacrosse Ball Trap Release|1|60|s|0
shoulders|Band External Rotation|3|12|r|30
shoulders|Wall Slides|2|10|r|20
shoulders|Cross-Body Shoulder Stretch|2|30|s|10
chest|Doorway Pec Stretch|3|30|s|15
chest|Scapular Push-Ups|2|10|r|20
chest|Foam Roll Pecs|1|60|s|0
biceps|Band Biceps Curl (light)|2|15|r|30
biceps|Biceps Wall Stretch|2|30|s|10
biceps|Eccentric Hammer Curl|2|10|r|30
triceps|Overhead Triceps Stretch|2|30|s|10
triceps|Band Triceps Pushdown|2|15|r|30
triceps|Triceps Foam Roll|1|45|s|0
forearms|Wrist Flexor Stretch|2|30|s|10
forearms|Wrist Extensor Stretch|2|30|s|10
forearms|Eccentric Wrist Curl|3|12|r|30
abs|Dead Bug|3|8|r|30
abs|Plank Hold|3|30|s|30
abs|Pelvic Tilts|2|12|r|20
obliques|Side Plank|2|25|s|30
obliques|Pallof Press|3|10|r|30
obliques|Standing Side Bend Stretch|2|30|s|10
lats|Child's Pose with Side Reach|2|30|s|10
lats|Lat Stretch on Rack|2|30|s|10
lats|Band Straight-Arm Pulldown|3|12|r|30
lowback|Cat-Cow|2|10|r|15
lowback|Bird Dog|3|8|r|30
lowback|Child's Pose|2|40|s|10
glutes|Glute Bridge|3|12|r|30
glutes|Clamshells|3|15|r|20
glutes|Figure-4 Glute Stretch|2|40|s|10
hips|90/90 Hip Switches|2|8|r|20
hips|Kneeling Hip Flexor Stretch|2|40|s|10
hips|Banded Lateral Walk|3|10|r|30
quads|Foam Roll Quads|1|90|s|0
quads|Standing Quad Stretch|2|30|s|10
quads|Terminal Knee Extension|3|15|r|30
quads|Wall Sit|3|30|s|30
hamstrings|Hamstring Nerve Floss|2|10|r|20
hamstrings|Supine Hamstring Stretch|2|40|s|10
hamstrings|Single-Leg Glute Bridge|3|10|r|30
calves|Wall Calf Stretch|2|40|s|10
calves|Eccentric Heel Drop|3|12|r|30
calves|Foam Roll Calves|1|90|s|0
shins|Toe Raises|3|15|r|30
shins|Toe Walks|2|30|s|20
shins|Kneeling Shin Stretch|2|30|s|10
feet|Ankle Circles|2|15|r|10
feet|Towel Scrunches|3|15|r|20
feet|Plantar Fascia Ball Roll|1|60|s|0`;
  const defaultExercises = () => DEFAULTS.trim().split('\n').map(l => {
    const p = l.split('|');
    return { id: uid(), group: p[0], name: p[1], sets: +p[2], reps: +p[3], unit: p[4], rest: +p[5] };
  });

  const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
  const KEY = { ex: 'apex_rehab_exercises', routines: 'apex_rehab_routines', sched: 'apex_rehab_schedule', draft: 'apex_rehab_draft' };
  const SEC_PER_REP = 4; // slow, controlled rehab tempo used for time estimates

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('rehab: save failed', e); } };
  const toast = m => (typeof window.showToast === 'function' ? window.showToast(m) : console.log(m));
  const exSecs = e => e.sets * (e.unit === 's' ? e.reps : e.reps * SEC_PER_REP) + Math.max(0, e.sets - 1) * (e.rest || 0);
  const sumSecs = items => items.reduce((a, e) => a + exSecs(e), 0);
  const fmtMin = s => `${Math.round(s / 6) / 10} min`;
  const dose = e => `${e.sets} × ${e.reps}${e.unit === 's' ? 's hold' : ' reps'}`;
  const INP = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500';
  const LBL = 'text-[11px] text-slate-400 font-medium block mb-1';
  const BTN = 'px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg border border-slate-700 transition text-xs';

  // ---------- state ----------
  const S = {
    ready: false, group: 'quads', exercises: [], routines: [], sched: {},
    draft: { id: null, name: '', budget: 30, items: [] },
    ui: { routinesOpen: true, schedOpen: true, openRoutines: {}, openSched: {}, editing: undefined, q: '' }
  };
  const saveEx = () => store(KEY.ex, S.exercises);
  const saveRoutines = () => store(KEY.routines, S.routines);
  const saveSched = () => store(KEY.sched, S.sched);
  const saveDraft = () => store(KEY.draft, S.draft);

  // ---------- skeleton ----------
  const card = (id, border, inner) => `<div id="${id}" class="glass-card rounded-2xl p-4 shadow-xl border ${border}">${inner}</div>`;
  const collapseHead = (emoji, title, sub, chevId, fn, tone) => `
    <button onclick="${fn}" class="w-full flex items-center justify-between text-left focus:outline-none">
      <div class="flex items-center gap-2"><span class="text-lg">${emoji}</span>
        <div><h3 class="text-sm font-bold text-slate-100">${title}</h3><p class="text-[11px] text-slate-400">${sub}</p></div></div>
      <span id="${chevId}" class="text-xs ${tone} font-bold">▲ Hide</span>
    </button>`;

  function skeleton() {
    return `
    <div class="glass-card rounded-2xl p-4 shadow-xl border border-rose-500/20 flex items-center gap-2">
      <span class="text-lg">🩹</span>
      <div><h3 class="text-sm font-bold text-slate-100">Rehab & Recovery</h3>
      <p class="text-[11px] text-slate-400">Tap a muscle to see suggested mobility & recovery work</p></div>
    </div>

    ${card('rhMapCard', 'border-indigo-500/20', `
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-slate-300">Body Map</span>
        <span id="rhSelected" class="text-xs font-bold text-indigo-300"></span>
      </div>
      <div class="bg-slate-950/80 rounded-xl border border-slate-800 p-2"><div id="rhBody"></div></div>
      <div id="rhLegend" class="flex flex-wrap gap-1.5 mt-3"></div>`)}

    ${card('rhPickerCard', 'border-emerald-500/20', `
      <div class="flex items-center justify-between gap-2 mb-1">
        <div><h3 id="rhPickerTitle" class="text-sm font-bold text-slate-100"></h3>
        <p class="text-[11px] text-slate-400">Tap ＋ to add to your workout. Edit any suggestion or add your own.</p></div>
        <div class="flex gap-1.5 flex-shrink-0">
          <button onclick="rh.newEx()" class="${BTN}"><i class="fa-solid fa-plus"></i> Custom</button>
          <button onclick="rh.resetEx()" class="${BTN}" title="Restore all suggestions"><i class="fa-solid fa-rotate-left"></i></button>
        </div>
      </div>
      <div id="rhPicker" class="space-y-2 mt-3"></div>
      <p class="text-[10px] text-slate-500 mt-3">General mobility ideas only — not medical advice. See a physio for injuries.</p>`)}

    ${card('rhBuilderCard', 'border-cyan-500/20', `
      <h2 class="text-base font-bold text-slate-200 flex items-center gap-2 mb-3"><span>🛠️</span> Custom Workout</h2>
      <div id="rhEditBanner" class="hidden text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 mb-2"></div>
      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="col-span-2"><label class="${LBL}">Routine name</label>
          <input id="rhName" type="text" placeholder="e.g. Post-leg-day reset" oninput="rh.setName(this.value)" class="${INP}"></div>
        <div><label class="${LBL}">Time budget (min)</label>
          <input id="rhBudget" type="number" min="0" step="5" oninput="rh.setBudget(this.value)" class="${INP}"></div>
      </div>
      <div id="rhItems" class="space-y-2"></div>
      <div id="rhTotals" class="mt-3"></div>
      <div class="flex gap-2 mt-3">
        <button onclick="rh.saveRoutine(false)" class="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold py-2.5 rounded-lg text-sm transition">Save Routine</button>
        <button id="rhSaveCopy" onclick="rh.saveRoutine(true)" class="hidden ${BTN}">Save as copy</button>
        <button onclick="rh.clearDraft()" class="${BTN}">Clear</button>
      </div>`)}

    ${card('rhRoutinesCard', 'border-indigo-500/20', `
      ${collapseHead('📚', 'Saved Routines', 'Search, edit, duplicate or delete', 'rhRoutinesChev', 'rh.toggleRoutines()', 'text-indigo-400')}
      <div id="rhRoutinesBody" class="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
        <input id="rhSearch" type="text" placeholder="🔍 Search routines, exercises or muscles..." oninput="rh.search(this.value)"
          class="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500">
        <div id="rhRoutineList" class="space-y-2"></div>
      </div>`)}

    ${card('rhScheduleCard', 'border-emerald-500/20', `
      ${collapseHead('📅', 'Weekly Schedule', 'Assign one or more routines to each day', 'rhSchedChev', 'rh.toggleSched()', 'text-emerald-400')}
      <div id="rhSchedBody" class="mt-3 pt-3 border-t border-slate-700/60"><div id="rhSchedule" class="space-y-2"></div></div>`)}`;
  }

  // ---------- init ----------
  function ensure() {
    const root = $('rehabTab');
    if (!root || S.ready) return !!root;
    S.exercises = load(KEY.ex, null);
    if (!Array.isArray(S.exercises) || !S.exercises.length) { S.exercises = defaultExercises(); saveEx(); }
    S.routines = load(KEY.routines, []);
    S.sched = load(KEY.sched, {});
    const d = load(KEY.draft, null);
    if (d && Array.isArray(d.items)) S.draft = Object.assign(S.draft, d);
    root.innerHTML = skeleton();
    $('rhBody').addEventListener('click', e => {
      const t = e.target.closest('[data-g]');
      if (t) rh.pick(t.dataset.g);
    });
    $('rhName').value = S.draft.name || '';
    $('rhBudget').value = S.draft.budget;
    S.ready = true;
    return true;
  }
  function renderAll() {
    renderCharacterView(); renderLegend(); renderPicker(); renderWorkout(); renderSchedule();
  }
  window.initRehabUI = function () { if (ensure()) renderAll(); };

  // ---------- Body map ----------
  window.renderCharacterView = function () {
    if (!ensure()) return;
    const fig = (cx, view) => {
      let o = `<g transform="translate(${cx},8)">
        <ellipse cx="0" cy="22" rx="16" ry="20" fill="#1e293b" stroke="#475569"/>
        <ellipse cx="-50" cy="194" rx="6" ry="9" fill="#1e293b" stroke="#475569"/>
        <ellipse cx="50" cy="194" rx="6" ry="9" fill="#1e293b" stroke="#475569"/>`;
      Z.forEach(g => {
        const p = SH[g] && SH[g][view]; if (!p) return;
        const one = m => `<path class="rh-region${S.group === g ? ' active' : ''}" data-g="${g}" fill="${color(g)}" d="${p}"${m ? ' transform="scale(-1,1)"' : ''}><title>${LABEL[g]}</title></path>`;
        o += one(false) + (CENTRAL.has(g) ? '' : one(true));
      });
      if (view === 'f') o += `<path d="M-10 122L10 122M-10 142L10 142M0 102L0 166" stroke="#0f172a" stroke-opacity=".55" stroke-width="1" fill="none" pointer-events="none"/>`;
      return o + '</g>';
    };
    $('rhBody').innerHTML = `<svg viewBox="0 0 410 404" class="rh-body-svg w-full" role="img" aria-label="Muscle map, front and back">
      ${fig(105, 'f')}${fig(305, 'b')}
      <text x="105" y="400" text-anchor="middle" fill="#94a3b8" font-size="10">Front</text>
      <text x="305" y="400" text-anchor="middle" fill="#94a3b8" font-size="10">Back</text></svg>`;
    $('rhSelected').textContent = LABEL[S.group];
  };

  window.renderLegend = function () {
    if (!ensure()) return;
    $('rhLegend').innerHTML = GROUPS.map(g => {
      const on = g[0] === S.group;
      return `<button onclick="rh.pick('${g[0]}')" class="rh-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${on ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}">
        <span class="w-2 h-2 rounded-full" style="background:${color(g[0])}"></span>${g[1]}</button>`;
    }).join('');
  };

  // ---------- Suggested exercise list ----------
  function formHTML(e) {
    const v = Object.assign({ name: '', sets: 2, reps: 10, unit: 'r', rest: 30 }, e);
    return `<div class="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 space-y-2">
      <input id="rhF_name" class="${INP}" placeholder="Exercise name" value="${esc(v.name)}">
      <div class="grid grid-cols-4 gap-2">
        <div><label class="${LBL}">Sets</label><input id="rhF_sets" type="number" min="1" value="${v.sets}" class="${INP}"></div>
        <div><label class="${LBL}">Reps/Secs</label><input id="rhF_reps" type="number" min="1" value="${v.reps}" class="${INP}"></div>
        <div><label class="${LBL}">Type</label><select id="rhF_unit" class="${INP}">
          <option value="r"${v.unit === 'r' ? ' selected' : ''}>Reps</option><option value="s"${v.unit === 's' ? ' selected' : ''}>Hold (s)</option></select></div>
        <div><label class="${LBL}">Rest (s)</label><input id="rhF_rest" type="number" min="0" step="5" value="${v.rest}" class="${INP}"></div>
      </div>
      <div class="flex gap-2">
        <button onclick="rh.saveEx()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg text-xs transition">Save</button>
        <button onclick="rh.cancelEx()" class="${BTN}">Cancel</button></div></div>`;
  }

  window.renderPicker = function () {
    if (!ensure()) return;
    const list = S.exercises.filter(e => e.group === S.group);
    $('rhPickerTitle').innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background:${color(S.group)}"></span>${LABEL[S.group]} — suggested exercises`;
    let html = S.ui.editing === null ? formHTML({}) : '';
    if (!list.length && S.ui.editing !== null) html += `<p class="text-xs text-slate-500 italic">No exercises here yet — tap Custom to add one.</p>`;
    html += list.map(e => {
      if (S.ui.editing === e.id) return formHTML(e);
      const inDraft = S.draft.items.some(i => i.src === e.id);
      return `<div class="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2">
        <div class="flex-1 min-w-0"><div class="text-xs font-bold text-slate-100 truncate">${esc(e.name)}</div>
          <div class="text-[11px] text-slate-400">${dose(e)} · rest ${e.rest}s · ≈ ${fmtMin(exSecs(e))}</div></div>
        <button onclick="rh.editEx('${e.id}')" class="p-1.5 text-slate-400 hover:text-white" title="Edit"><i class="fa-solid fa-pen text-[11px]"></i></button>
        <button onclick="rh.delEx('${e.id}')" class="p-1.5 text-slate-400 hover:text-rose-400" title="Delete"><i class="fa-solid fa-trash text-[11px]"></i></button>
        <button onclick="rh.toggleDraft('${e.id}')" class="w-8 h-8 rounded-lg text-xs font-bold transition ${inDraft ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}" title="${inDraft ? 'Remove from workout' : 'Add to workout'}">
          <i class="fa-solid ${inDraft ? 'fa-check' : 'fa-plus'}"></i></button></div>`;
    }).join('');
    $('rhPicker').innerHTML = html;
  };

  // ---------- Custom workout builder ----------
  function renderItems() {
    const it = S.draft.items;
    $('rhItems').innerHTML = it.length ? it.map((e, i) => `
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color(e.group)}"></span>
          <div class="flex-1 min-w-0"><div class="text-xs font-bold text-slate-100 truncate">${esc(e.name)}</div>
            <div class="text-[10px] text-slate-500">${LABEL[e.group] || ''} · ≈ ${fmtMin(exSecs(e))}</div></div>
          <button onclick="rh.moveItem(${i},-1)" class="p-1 text-slate-500 hover:text-white"><i class="fa-solid fa-chevron-up text-[10px]"></i></button>
          <button onclick="rh.moveItem(${i},1)" class="p-1 text-slate-500 hover:text-white"><i class="fa-solid fa-chevron-down text-[10px]"></i></button>
          <button onclick="rh.removeItem(${i})" class="p-1 text-slate-500 hover:text-rose-400"><i class="fa-solid fa-xmark text-xs"></i></button>
        </div>
        <div class="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
          <input type="number" min="1" value="${e.sets}" onchange="rh.itemSet(${i},'sets',this.value)" class="w-14 ${INP}"> sets ×
          <input type="number" min="1" value="${e.reps}" onchange="rh.itemSet(${i},'reps',this.value)" class="w-14 ${INP}"> ${e.unit === 's' ? 'sec' : 'reps'}
          · rest <input type="number" min="0" step="5" value="${e.rest}" onchange="rh.itemSet(${i},'rest',this.value)" class="w-14 ${INP}">s
        </div></div>`).join('')
      : `<p class="text-xs text-slate-500 italic text-center py-3">Pick a muscle above and tap ＋ on exercises to build your routine.</p>`;
  }

  function renderTotals() {
    const t = sumSecs(S.draft.items), b = +S.draft.budget || 0, n = S.draft.items.length;
    let msg = '', tone = 'emerald';
    if (b > 0 && n) {
      if (t > b * 60 + 3) { tone = 'rose'; msg = `${fmtMin(t - b * 60)} over budget — remove or shorten an exercise`; }
      else msg = `${fmtMin(Math.max(0, b * 60 - t))} to spare`;
    }
    const pct = b > 0 ? Math.min(100, (t / (b * 60)) * 100) : 0;
    $('rhTotals').innerHTML = `<div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
      <div class="flex items-center justify-between"><span class="text-xs text-slate-400">${n} exercise${n === 1 ? '' : 's'}</span>
        <span class="text-sm font-extrabold text-${tone}-400">Total ≈ ${fmtMin(t)}</span></div>
      ${b > 0 && n ? `<div class="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-800"><div class="bg-${tone}-400 h-full transition-all duration-300" style="width:${pct}%"></div></div>
      <p class="text-[11px] text-${tone}-300 mt-1.5">${msg}</p>` : ''}</div>`;
  }

  function renderBanner() {
    const el = $('rhEditBanner'), r = S.routines.find(x => x.id === S.draft.id);
    el.classList.toggle('hidden', !r);
    $('rhSaveCopy').classList.toggle('hidden', !r);
    if (r) el.innerHTML = `Editing “${esc(r.name)}” — Save Routine overwrites it.`;
  }

  // ---------- Saved routines ----------
  function renderRoutineList() {
    const q = S.ui.q.trim().toLowerCase();
    const list = S.routines.filter(r => !q || r.name.toLowerCase().includes(q) ||
      r.items.some(i => i.name.toLowerCase().includes(q) || (LABEL[i.group] || '').toLowerCase().includes(q)));
    $('rhRoutineList').innerHTML = list.length ? list.map(r => {
      const open = !!S.ui.openRoutines[r.id];
      return `<div class="bg-slate-900/70 border border-slate-800 rounded-xl">
        <button onclick="rh.toggleRoutine('${r.id}')" class="w-full flex items-center justify-between px-3 py-2.5 text-left">
          <div><div class="text-xs font-bold text-slate-100">${esc(r.name)}</div>
            <div class="text-[11px] text-slate-400">${r.items.length} exercises · ≈ ${fmtMin(sumSecs(r.items))}</div></div>
          <span class="text-[11px] text-indigo-400 font-bold">${open ? '▲' : '▼'}</span></button>
        ${open ? `<div class="px-3 pb-3 pt-2 border-t border-slate-800 space-y-1.5">
          ${r.items.map(i => `<div class="flex justify-between text-[11px] text-slate-300"><span><span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style="background:${color(i.group)}"></span>${esc(i.name)}</span><span class="text-slate-500">${dose(i)}</span></div>`).join('')}
          <div class="flex gap-1.5 pt-2">
            <button onclick="rh.editRoutine('${r.id}')" class="${BTN}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button onclick="rh.dupRoutine('${r.id}')" class="${BTN}"><i class="fa-solid fa-copy"></i> Duplicate</button>
            <button onclick="rh.delRoutine('${r.id}')" class="${BTN} !text-rose-300 !border-rose-500/30"><i class="fa-solid fa-trash"></i> Delete</button></div></div>` : ''}</div>`;
    }).join('') : `<p class="text-xs text-slate-500 italic text-center py-3">${S.routines.length ? 'No routines match your search.' : 'No saved routines yet — build one above and tap Save Routine.'}</p>`;
    $('rhRoutinesBody').classList.toggle('hidden', !S.ui.routinesOpen);
    $('rhRoutinesChev').textContent = S.ui.routinesOpen ? '▲ Hide' : '▼ Show';
  }

  window.renderWorkout = function () {
    if (!ensure()) return;
    renderBanner(); renderItems(); renderTotals(); renderRoutineList();
  };

  // ---------- Weekly schedule ----------
  window.renderSchedule = function () {
    if (!ensure()) return;
    const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
    const byId = {}; S.routines.forEach(r => byId[r.id] = r);
    let week = 0;
    const rows = DAYS.map(([k, name]) => {
      const ids = (S.sched[k] || []).filter(id => byId[id]);
      const mins = ids.reduce((a, id) => a + sumSecs(byId[id].items), 0); week += mins;
      const avail = S.routines.filter(r => !ids.includes(r.id));
      return `<div class="bg-slate-900/70 border ${k === todayKey ? 'border-emerald-500/50' : 'border-slate-800'} rounded-xl p-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-bold ${k === todayKey ? 'text-emerald-400' : 'text-slate-200'}">${name}${k === todayKey ? ' · today' : ''}</span>
          <span class="text-[11px] text-slate-400">${ids.length ? '≈ ' + fmtMin(mins) : 'Rest day'}</span></div>
        <div class="space-y-1.5">${ids.map(id => {
          const r = byId[id], open = S.ui.openSched[k + id];
          return `<div class="bg-slate-800/70 rounded-lg"><div class="flex items-center">
            <button onclick="rh.toggleSchedItem('${k}','${id}')" class="flex-1 text-left px-2.5 py-1.5 text-[11px] font-semibold text-slate-100">${open ? '▲' : '▼'} ${esc(r.name)} <span class="text-slate-500 font-normal">· ${fmtMin(sumSecs(r.items))}</span></button>
            <button onclick="rh.unschedule('${k}','${id}')" class="px-2.5 text-slate-500 hover:text-rose-400"><i class="fa-solid fa-xmark text-xs"></i></button></div>
            ${open ? `<div class="px-2.5 pb-2 space-y-0.5">${r.items.map(i => `<div class="text-[11px] text-slate-400">• ${esc(i.name)} — ${dose(i)}</div>`).join('')}</div>` : ''}</div>`;
        }).join('')}</div>
        ${avail.length ? `<select onchange="rh.schedule('${k}',this.value);this.value=''" class="${INP} mt-2"><option value="">＋ Add routine…</option>
          ${avail.map(r => `<option value="${r.id}">${esc(r.name)} (${fmtMin(sumSecs(r.items))})</option>`).join('')}</select>` : ''}</div>`;
    }).join('');
    $('rhSchedule').innerHTML = (S.routines.length ? '' : `<p class="text-xs text-slate-500 italic text-center py-2">Save a routine first, then schedule it here.</p>`) +
      `<div class="text-[11px] text-slate-400 text-right mb-1">Week total ≈ ${fmtMin(week)}</div>` + rows;
    $('rhSchedBody').classList.toggle('hidden', !S.ui.schedOpen);
    $('rhSchedChev').textContent = S.ui.schedOpen ? '▲ Hide' : '▼ Show';
  };

  // ---------- Actions (called from onclick attributes) ----------
  const num = (v, min, dflt) => { const n = parseFloat(v); return isNaN(n) ? dflt : Math.max(min, n); };
  const rh = window.rh = {
    pick(g) { S.group = g; S.ui.editing = undefined; renderCharacterView(); renderLegend(); renderPicker();
      $('rhPickerCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); },
    newEx() { S.ui.editing = null; renderPicker(); },
    editEx(id) { S.ui.editing = id; renderPicker(); },
    cancelEx() { S.ui.editing = undefined; renderPicker(); },
    saveEx() {
      const name = $('rhF_name').value.trim();
      if (!name) return toast('Give the exercise a name');
      const v = { name, sets: num($('rhF_sets').value, 1, 2), reps: num($('rhF_reps').value, 1, 10),
        unit: $('rhF_unit').value, rest: num($('rhF_rest').value, 0, 30) };
      if (S.ui.editing) Object.assign(S.exercises.find(e => e.id === S.ui.editing) || {}, v);
      else S.exercises.push(Object.assign({ id: uid(), group: S.group }, v));
      S.ui.editing = undefined; saveEx(); renderPicker(); toast('Exercise saved');
    },
    delEx(id) {
      if (!confirm('Delete this exercise from the suggestions? (Saved routines keep their copy.)')) return;
      S.exercises = S.exercises.filter(e => e.id !== id); saveEx(); renderPicker();
    },
    resetEx() {
      if (!confirm('Restore the original suggestions? Your edits and custom exercises will be lost.')) return;
      S.exercises = defaultExercises(); S.ui.editing = undefined; saveEx(); renderPicker(); toast('Suggestions restored');
    },
    toggleDraft(id) {
      const i = S.draft.items.findIndex(x => x.src === id);
      if (i >= 0) S.draft.items.splice(i, 1);
      else { const e = S.exercises.find(x => x.id === id); if (!e) return;
        S.draft.items.push({ uid: uid(), src: e.id, name: e.name, group: e.group, sets: e.sets, reps: e.reps, unit: e.unit, rest: e.rest }); }
      saveDraft(); renderPicker(); renderItems(); renderTotals();
    },
    setName(v) { S.draft.name = v; saveDraft(); },
    setBudget(v) { S.draft.budget = num(v, 0, 0); saveDraft(); renderTotals(); },
    itemSet(i, f, v) { const e = S.draft.items[i]; if (!e) return; e[f] = num(v, f === 'rest' ? 0 : 1, e[f]); saveDraft(); renderItems(); renderTotals(); },
    moveItem(i, d) { const a = S.draft.items, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; saveDraft(); renderItems(); },
    removeItem(i) { S.draft.items.splice(i, 1); saveDraft(); renderPicker(); renderItems(); renderTotals(); },
    clearDraft() { S.draft = { id: null, name: '', budget: S.draft.budget, items: [] }; $('rhName').value = ''; saveDraft(); renderPicker(); renderWorkout(); },
    saveRoutine(asCopy) {
      const name = S.draft.name.trim();
      if (!name) return toast('Name your routine first');
      if (!S.draft.items.length) return toast('Add at least one exercise');
      const items = S.draft.items.map(i => Object.assign({}, i));
      const ex = !asCopy && S.routines.find(r => r.id === S.draft.id);
      if (ex) { ex.name = name; ex.items = items; }
      else S.routines.push({ id: uid(), name, items });
      saveRoutines(); rh.clearDraft(); renderSchedule(); toast('Routine saved');
    },
    toggleRoutines() { S.ui.routinesOpen = !S.ui.routinesOpen; renderRoutineList(); },
    toggleRoutine(id) { S.ui.openRoutines[id] = !S.ui.openRoutines[id]; renderRoutineList(); },
    search(v) { S.ui.q = v; renderRoutineList(); },
    editRoutine(id) {
      const r = S.routines.find(x => x.id === id); if (!r) return;
      S.draft = { id: r.id, name: r.name, budget: S.draft.budget, items: r.items.map(i => Object.assign({}, i, { uid: uid() })) };
      $('rhName').value = r.name; saveDraft(); renderPicker(); renderWorkout();
      $('rhBuilderCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    dupRoutine(id) {
      const r = S.routines.find(x => x.id === id); if (!r) return;
      S.routines.push({ id: uid(), name: r.name + ' (copy)', items: r.items.map(i => Object.assign({}, i)) });
      saveRoutines(); renderWorkout(); renderSchedule();
    },
    delRoutine(id) {
      if (!confirm('Delete this routine? It will also be removed from your weekly schedule.')) return;
      S.routines = S.routines.filter(r => r.id !== id);
      Object.keys(S.sched).forEach(k => { S.sched[k] = S.sched[k].filter(x => x !== id); });
      if (S.draft.id === id) S.draft.id = null;
      saveRoutines(); saveSched(); saveDraft(); renderWorkout(); renderSchedule();
    },
    toggleSched() { S.ui.schedOpen = !S.ui.schedOpen; renderSchedule(); },
    toggleSchedItem(k, id) { S.ui.openSched[k + id] = !S.ui.openSched[k + id]; renderSchedule(); },
    schedule(k, id) { if (!id) return; (S.sched[k] = S.sched[k] || []).push(id); saveSched(); renderSchedule(); },
    unschedule(k, id) { S.sched[k] = (S.sched[k] || []).filter(x => x !== id); saveSched(); renderSchedule(); }
  };
})();
