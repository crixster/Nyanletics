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

// ---------- Muscle groups & Joint groups: id, label, hue ----------
  const GROUPS = [
    ['neck', 'Neck', 200], ['traps', 'Traps', 265], 
    ['shoulders', 'Shoulders', 35], ['chest', 'Chest', 0], 
    ['biceps', 'Biceps', 48], ['triceps', 'Triceps', 28], ['elbows', 'Elbows (Joint)', 160], 
    ['forearms', 'Forearms', 170], ['wrists', 'Wrists (Joint)', 220],
    ['abs', 'Abs', 140], ['obliques', 'Obliques', 185], ['lats', 'Lats', 120],
    ['lowback', 'Lower Back', 290], ['glutes', 'Glutes', 320], ['hips', 'Hips', 80],
    ['quads', 'Quads', 10], ['hamstrings', 'Hamstrings', 345],
    ['knees', 'Knees (Joint)', 150], ['calves', 'Calves', 215], ['shins', 'Shins', 95],
    ['ankles', 'Ankles (Joint)', 250], ['feet', 'Feet', 240]
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
feet|Plantar Fascia Ball Roll|1|60|s|0
shoulders|Shoulder CARs (Controlled Rotations)|3|5|r|20
shoulders|Pendulum Swings|2|30|s|10
elbows|Elbow CARs|2|10|r|15
elbows|Forearm Pronation / Supination|3|12|r|20
wrists|Wrist CARs|2|10|r|10
wrists|Prayer Stretch|2|30|s|15
hips|Hip CARs|3|5|r|20
hips|90/90 Hip Rotations|2|8|r|20
knees|Tibial Rotations|2|10|r|15
knees|Terminal Knee Extensions|3|12|r|20
ankles|Ankle CARs / Alphabet|2|10|r|15
ankles|Banded Ankle Distraction|2|30|s|20`;
  const defaultExercises = () => DEFAULTS.trim().split('\n').map(l => {
    const p = l.split('|');
    return { id: uid(), group: p[0], name: p[1], sets: +p[2], reps: +p[3], unit: p[4], rest: +p[5], also: [], desc: '', video: '', img: '' };
  });

  const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
  const KEY = { ex: 'apex_rehab_exercises', routines: 'apex_rehab_routines', sched: 'apex_rehab_schedule', draft: 'apex_rehab_draft' };
  const SEC_PER_REP = 4; // slow, controlled rehab tempo used for time estimates

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('rehab: save failed', e); return false; } };
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
    ui: { routinesOpen: true, schedOpen: true, openRoutines: {}, openSched: {}, editing: undefined, q: '', openEx: {}, formImg: '' }
  };
  const saveEx = () => { if (!store(KEY.ex, S.exercises)) toast('Storage full — use a smaller photo or remove one'); };
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

    // Groups that were merged into another group
    const MERGED = { hip_joints: 'hips', shoulder_joints: 'shoulders' };
    const fixG = g => MERGED[g] || g;

    // Load existing exercises from LocalStorage
    S.exercises = load(KEY.ex, null);

    let migrated = false;
    const fixEx = e => {
      if (MERGED[e.group]) { e.group = fixG(e.group); migrated = true; }
      if (Array.isArray(e.also) && e.also.some(g => MERGED[g])) {
        e.also = [...new Set(e.also.map(fixG))].filter(g => g !== e.group);
        migrated = true;
      }
    };
    if (Array.isArray(S.exercises)) S.exercises.forEach(fixEx);

    if (!Array.isArray(S.exercises) || !S.exercises.length) {
      S.exercises = defaultExercises();
      saveEx();
    } else {
      const existingNames = new Set(S.exercises.map(e => e.name));
      let added = false;
      defaultExercises().forEach(de => {
        if (!existingNames.has(de.name)) { S.exercises.push(de); added = true; }
      });
      if (added || migrated) saveEx();
    }

    S.routines = load(KEY.routines, []);
    S.sched = load(KEY.sched, {});
    const d = load(KEY.draft, null);
    if (d && Array.isArray(d.items)) S.draft = Object.assign(S.draft, d);

    // Same migration for routine items and the in-progress draft
    let rMig = false;
    const fixItem = i => { if (MERGED[i.group]) { i.group = fixG(i.group); rMig = true; } };
    S.routines.forEach(r => (r.items || []).forEach(fixItem));
    (S.draft.items || []).forEach(fixItem);
    if (rMig) { saveRoutines(); saveDraft(); }

    root.innerHTML = skeleton();
    $('rhBody').addEventListener('click', e => {
      const t = e.target.closest('[data-g]');
      if (t) rh.pick(t.dataset.g);
    });
    $('rhName').value = S.draft.name || '';$('rhBudget').value = S.draft.budget;
    S.ready = true;
    return true;
  }

  function renderAll() {
    renderCharacterView(); renderLegend(); renderPicker(); renderWorkout(); renderRoutines(); renderSchedule();
  }
  window.initRehabUI = function () { if (ensure()) renderAll(); };

  // ---------- Body map ----------
  window.renderCharacterView = function () {
    if (!ensure()) return;

    // Joint button coordinates relative to figure center
    const JOINTS = [
      ['elbows', 39, 135],
      ['wrists', 45, 184],
      ['hips', 18, 170, 'b'],
      ['knees', 18, 269],
      ['ankles', 16, 349]
    ];

    const fig = (cx, view) => {
      // Pixel Art Cute Cat Head
      const catHead = view === 'f' ? `
        <g class="pixel-cat-head" shape-rendering="crispEdges">
          <path d="M-16 12 L-16 2 L-10 2 L-10 6 L-6 10 L-6 12 Z" fill="#334155" />
          <path d="M-14 10 L-14 4 L-10 4 L-10 8 Z" fill="#f472b6" />
          <path d="M16 12 L16 2 L10 2 L10 6 L6 10 L6 12 Z" fill="#334155" />
          <path d="M14 10 L14 4 L10 4 L10 8 Z" fill="#f472b6" />
          <rect x="-18" y="10" width="36" height="26" rx="3" fill="#f1f5f9" stroke="#0f172a" stroke-width="2" />
          <rect x="-10" y="18" width="5" height="7" fill="#0f172a" rx="1" />
          <rect x="-10" y="18" width="2" height="3" fill="#ffffff" />
          <rect x="5" y="18" width="5" height="7" fill="#0f172a" rx="1" />
          <rect x="5" y="18" width="2" height="3" fill="#ffffff" />
          <rect x="-14" y="24" width="4" height="2" fill="#f472b6" opacity="0.8" />
          <rect x="10" y="24" width="4" height="2" fill="#f472b6" opacity="0.8" />
          <rect x="-1" y="24" width="2" height="2" fill="#f472b6" />
          <path d="M-4 27 Q-2 29 0 27 Q2 29 4 27" stroke="#0f172a" stroke-width="1.5" fill="none" stroke-linecap="round" />
          <path d="M-17 21 L-23 19 M-17 25 L-23 26" stroke="#818cf8" stroke-width="1.5" stroke-linecap="round" />
          <path d="M17 21 L23 19 M17 25 L23 26" stroke="#818cf8" stroke-width="1.5" stroke-linecap="round" />
        </g>
      ` : `
        <g class="pixel-cat-head" shape-rendering="crispEdges">
          <path d="M-16 12 L-16 2 L-10 2 L-10 6 L-6 10 L-6 12 Z" fill="#1e293b" />
          <path d="M16 12 L16 2 L10 2 L10 6 L6 10 L6 12 Z" fill="#1e293b" />
          <rect x="-18" y="10" width="36" height="26" rx="3" fill="#cbd5e1" stroke="#0f172a" stroke-width="2" />
          <rect x="-4" y="12" width="8" height="6" fill="#818cf8" />
          <rect x="-10" y="18" width="5" height="4" fill="#818cf8" />
          <rect x="5" y="18" width="5" height="4" fill="#818cf8" />
        </g>
      `;

      let o = `<g transform="translate(${cx},8)">
        ${catHead}
        <ellipse cx="-50" cy="194" rx="6" ry="9" fill="#1e293b" stroke="#475569"/>
        <ellipse cx="50" cy="194" rx="6" ry="9" fill="#1e293b" stroke="#475569"/>`;

      // Muscle Regions
      Z.forEach(g => {
        const p = SH[g] && SH[g][view]; if (!p) return;
        const one = m => `<path class="rh-region${S.group === g ? ' active' : ''}" data-g="${g}" fill="${color(g)}" d="${p}"${m ? ' transform="scale(-1,1)"' : ''}><title>${LABEL[g]}</title></path>`;
        o += one(false) + (CENTRAL.has(g) ? '' : one(true));
      });

      if (view === 'f') o += `<path d="M-10 122L10 122M-10 142L10 142M0 102L0 166" stroke="#0f172a" stroke-opacity=".55" stroke-width="1" fill="none" pointer-events="none"/>`;

      // Interactive Joint Buttons (Shoulders, Elbows, Wrists, Hips, Knees, Ankles)
      JOINTS.forEach(([gid, jx, jy, only]) => {
        if (only && only !== view) return;
        const activeClass = S.group === gid ? ' active' : '';
        o += `<circle class="rh-region rh-joint${activeClass}" data-g="${gid}" cx="${-jx}" cy="${jy}" r="6.5" fill="${color(gid)}" stroke="#ffffff" stroke-width="1.5"><title>${LABEL[gid]}</title></circle>`;
        o += `<circle class="rh-region rh-joint${activeClass}" data-g="${gid}" cx="${jx}" cy="${jy}" r="6.5" fill="${color(gid)}" stroke="#ffffff" stroke-width="1.5"><title>${LABEL[gid]}</title></circle>`;
      });

      return o + '</g>';
    };

    $('rhBody').innerHTML = `<svg viewBox="0 0 410 404" class="rh-body-svg w-full" role="img" aria-label="Muscle map, front and back">
      <defs>
        <pattern id="pixelGrid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#334155" stroke-width="1" opacity="0.25"/>
        </pattern>
      </defs>
      
      <!-- Retro Background -->
      <g class="pixel-art-bg" shape-rendering="crispEdges">
        <rect width="410" height="390" rx="12" fill="#090d16" />
        <rect width="410" height="390" rx="12" fill="url(#pixelGrid)" />
        
        <!-- Floating Pixel Stars -->
        <path d="M 35 35 h 4 v -4 h -4 v -4 h -4 v 4 h -4 v 4 h 4 v 4 h 4 Z" fill="#38bdf8" opacity="0.8"/>
        <path d="M 205 22 h 4 v -4 h -4 v -4 h -4 v 4 h -4 v 4 h 4 v 4 h 4 Z" fill="#f472b6" opacity="0.8"/>
        <path d="M 375 42 h 3 v -3 h -3 v -3 h -3 v 3 h -3 v 3 h 3 v 3 h 3 Z" fill="#818cf8" opacity="0.7"/>
        <path d="M 195 340 h 3 v -3 h -3 v -3 h -3 v 3 h -3 v 3 h 3 v 3 h 3 Z" fill="#38bdf8" opacity="0.6"/>
      </g>

      ${fig(105, 'f')}${fig(305, 'b')}
      <text x="105" y="398" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="bold">FRONT</text>
      <text x="305" y="398" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="bold">BACK</text>
    </svg>`;
    $('rhSelected').textContent = LABEL[S.group];
  };

  // ---------- Legend (tap-to-select chips under the body map) ----------
  window.renderLegend = function () {
    if (!ensure()) return;
    const el = $('rhLegend'); if (!el) return;
    el.innerHTML = GROUPS.map(([id, label]) => {
      const on = S.group === id;
      return `<button type="button" onclick="rh.pick('${id}')"
        class="rh-chip inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold transition ${on ? 'bg-indigo-600/30 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}">
        <span class="w-2 h-2 rounded-full" style="background:${color(id)}"></span>${label}</button>`;
    }).join('');
  };

  // ---------- Suggested exercise list ----------
  // An exercise lives under its primary group (e.group) and is also shown under every group in e.also.
  const belongs = (e, g) => e.group === g || (e.also || []).includes(g);
  const cleanUrl = u => {
    u = (u || '').trim(); if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { return new URL(u).href; } catch (e) { return ''; }
  };

  // Resize photos to max 640px JPEG so they fit comfortably in localStorage
  const readImage = file => new Promise((res, rej) => {
    const fr = new FileReader(); fr.onerror = rej;
    fr.onload = () => {
      const im = new Image(); im.onerror = rej;
      im.onload = () => {
        const k = Math.min(1, 640 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.75));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  const prevHTML = () => S.ui.formImg
    ? `<div class="relative inline-block mt-2"><img src="${esc(S.ui.formImg)}" onclick="rh.viewImg()" class="h-24 max-w-full rounded-lg border border-slate-700 object-contain cursor-zoom-in">
        <button type="button" onclick="rh.clearImage()" class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px]"><i class="fa-solid fa-xmark"></i></button></div>` : '';

  // ---------- Fullscreen photo viewer (tap anywhere / press Esc to close) ----------
  function onViewerKey(e) { if (e.key === 'Escape') closeViewer(); }
  function closeViewer() {
    const v = $('rhViewer');
    if (v) v.remove();
    document.removeEventListener('keydown', onViewerKey);
    document.body.style.overflow = '';
  }
  function openViewer(src, alt) {
    if (!src) return;
    closeViewer();
    const v = document.createElement('div');
    v.id = 'rhViewer';
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-modal', 'true');
    v.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.96);display:flex;align-items:center;justify-content:center;padding:8px;cursor:zoom-out;';
    const im = document.createElement('img');
    im.src = src;
    im.alt = alt || 'Exercise photo';
    im.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '\u2715';
    x.setAttribute('aria-label', 'Close');
    x.style.cssText = 'position:absolute;top:max(12px,env(safe-area-inset-top));right:12px;width:36px;height:36px;border-radius:9999px;background:rgba(30,41,59,.9);color:#fff;font-size:16px;border:1px solid #475569;';
    v.appendChild(im);
    v.appendChild(x);
    v.addEventListener('click', closeViewer);
    document.addEventListener('keydown', onViewerKey);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(v);
  }

  function formHTML(e) {
    const v = Object.assign({ name: '', sets: 2, reps: 10, unit: 'r', rest: 30, also: [], desc: '', video: '' }, e);
    const prim = v.group || S.group;
    return `<div class="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 space-y-2">
      <input id="rhF_name" class="${INP}" placeholder="Exercise name" value="${esc(v.name)}">
      <div class="grid grid-cols-4 gap-2">
        <div><label class="${LBL}">Sets</label><input id="rhF_sets" type="number" min="1" value="${v.sets}" class="${INP}"></div>
        <div><label class="${LBL}">Reps/Secs</label><input id="rhF_reps" type="number" min="1" value="${v.reps}" class="${INP}"></div>
        <div><label class="${LBL}">Type</label><select id="rhF_unit" class="${INP}">
          <option value="r"${v.unit === 'r' ? ' selected' : ''}>Reps</option><option value="s"${v.unit === 's' ? ' selected' : ''}>Hold (s)</option></select></div>
        <div><label class="${LBL}">Rest (s)</label><input id="rhF_rest" type="number" min="0" step="5" value="${v.rest}" class="${INP}"></div>
      </div>
      <div><label class="${LBL}">Also works these muscle & joints (tick to show it under them too)</label>
        <div class="flex flex-wrap gap-1.5">${GROUPS.map(g => {
          const lock = g[0] === prim;
          return `<label class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] ${lock ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200' : 'bg-slate-800 border-slate-700 text-slate-300'} cursor-pointer select-none">
            <input type="checkbox" class="rhF_grp" value="${g[0]}" ${lock || v.also.includes(g[0]) ? 'checked' : ''}${lock ? 'disabled' : ''}>${g[1]}${lock ? ' (main)' : ''}</label>`;
        }).join('')}</div></div>
      <div><label class="${LBL}">Description / how to do it</label>
        <textarea id="rhF_desc" class="${INP} h-16" placeholder="Form cues, setup instructions, or notes...">${esc(v.desc || '')}</textarea></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="${LBL}">Video URL (YouTube or web)</label>
          <input id="rhF_video" class="${INP}" placeholder="https://..." value="${esc(v.video || '')}"></div>
        <div><label class="${LBL}">Reference Photo</label>
          <input type="file" id="rhF_imgFile" accept="image/*" onchange="rh.handleImg(event)" class="${INP}">
          <div id="rhF_imgPrev">${prevHTML()}</div></div>
      </div>
      <div class="flex gap-2 pt-1">
        <button onclick="rh.saveExForm('${v.id || ''}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1.5 rounded-lg text-xs transition">Save Exercise</button>
        <button onclick="rh.cancelExForm()" class="${BTN}">Cancel</button>
      </div>
    </div>`;
  }

  window.renderPicker = function () {
    if (!ensure()) return;
    $('rhPickerTitle').textContent = `${LABEL[S.group]} Exercises`;
    const items = S.exercises.filter(e => belongs(e, S.group));
    const container = $('rhPicker');
    if (!items.length && S.ui.editing !== 'new') {
      container.innerHTML = `<p class="text-xs text-slate-400 italic">No exercises saved for ${LABEL[S.group]} yet. Tap ＋ Custom to add one.</p>`;
      return;
    }
    container.innerHTML = items.map(e => {
      if (S.ui.editing === e.id) return formHTML(e);
      const isExpanded = S.ui.openEx[e.id];
      const hasSecondary = Array.isArray(e.also) && e.also.length > 0;
      return `<div class="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="cursor-pointer flex-1" onclick="rh.toggleExDetails('${e.id}')">
            <h4 class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              ${esc(e.name)}
              <i class="fa-solid fa-chevron-down text-[10px] text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}"></i>
            </h4>
            <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
              <span class="text-indigo-300 font-semibold">${dose(e)}</span>
              <span>•</span>
              <span>~${fmtMin(exSecs(e))}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button onclick="rh.addEx('${e.id}')" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition" title="Add to workout">＋ Add</button>
            <button onclick="rh.editEx('${e.id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition"><i class="fa-solid fa-pen"></i></button>
            <button onclick="rh.delEx('${e.id}')" class="px-2 py-1 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 text-xs rounded-lg border border-slate-700 transition"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        ${hasSecondary ? `<div class="flex flex-wrap gap-1">
          ${e.also.map(g => `<span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">${LABEL[g] || g}</span>`).join('')}
        </div>` : ''}
        ${isExpanded ? `<div class="pt-2 border-t border-slate-800/80 text-xs text-slate-300 space-y-2">
          ${e.desc ? `<p class="whitespace-pre-wrap text-slate-400">${esc(e.desc)}</p>` : ''}
          ${e.img ? `<div><img src="${esc(e.img)}" onclick="rh.viewImg('${e.id}')" class="max-h-48 max-w-full rounded-lg border border-slate-700 object-contain cursor-zoom-in"></div>` : ''}
          ${e.video ? `<div><a href="${esc(cleanUrl(e.video))}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:underline"><i class="fa-brands fa-youtube"></i> Watch video tutorial</a></div>` : ''}
        </div>` : ''}
      </div>`;
    }).join('') + (S.ui.editing === 'new' ? formHTML() : '');
  };

  // ---------- Custom Workout Builder ----------
  window.renderWorkout = function () {
    if (!ensure()) return;
    const banner = $('rhEditBanner');
    if (S.draft.id) {
      banner.classList.remove('hidden');
      banner.innerHTML = `Editing saved routine: <strong>${esc(S.draft.name)}</strong>. Changes overwrite this routine unless you click "Save as copy".`;
      $('rhSaveCopy').classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
      $('rhSaveCopy').classList.add('hidden');
    }

    const itemsContainer = $('rhItems');
    if (!S.draft.items.length) {
      itemsContainer.innerHTML = `<p class="text-xs text-slate-400 italic">Your custom workout is empty. Tap ＋ Add on any exercise above to build your routine.</p>`;
    } else {
      itemsContainer.innerHTML = S.draft.items.map((item, idx) => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-slate-100 truncate">${esc(item.name)}</h4>
            <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
              <span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">${LABEL[item.group] || item.group}</span>
              <span>${dose(item)}</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="rh.moveItem(${idx}, -1)" class="p-1 hover:bg-slate-800 rounded text-slate-400" ${idx === 0 ? 'disabled class="opacity-30 p-1"' : ''}><i class="fa-solid fa-arrow-up"></i></button>
            <button onclick="rh.moveItem(${idx}, 1)" class="p-1 hover:bg-slate-800 rounded text-slate-400" ${idx === S.draft.items.length - 1 ? 'disabled class="opacity-30 p-1"' : ''}><i class="fa-solid fa-arrow-down"></i></button>
            <button onclick="rh.removeItem(${idx})" class="p-1 hover:bg-slate-800 rounded text-rose-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>
      `).join('');
    }

    const totalSecs = sumSecs(S.draft.items);
    const budgetSecs = (S.draft.budget || 0) * 60;
    const isOver = budgetSecs > 0 && totalSecs > budgetSecs;

    $('rhTotals').innerHTML = `
      <div class="flex justify-between items-center text-xs font-bold border-t border-slate-800 pt-2">
        <span class="text-slate-300">Estimated Duration:</span>
        <span class="${isOver ? 'text-rose-400' : 'text-emerald-400'}">${fmtMin(totalSecs)} ${S.draft.budget ? `/ ${S.draft.budget} min target` : ''}</span>
      </div>
      ${isOver ? `<p class="text-[11px] text-rose-400 mt-1">⚠️ Exceeds time budget by ${fmtMin(totalSecs - budgetSecs)}</p>` : ''}
    `;
  };

  // ---------- Saved Routines & Search ----------
  window.renderRoutines = function () {
    if (!ensure()) return;
    const list = $('rhRoutineList');
    const q = (S.ui.q || '').toLowerCase();
    const filtered = S.routines.filter(r => {
      if (!q) return true;
      if (r.name.toLowerCase().includes(q)) return true;
      return r.items.some(i => i.name.toLowerCase().includes(q) || (LABEL[i.group] || i.group).toLowerCase().includes(q));
    });

    if (!filtered.length) {
      list.innerHTML = `<p class="text-xs text-slate-400 italic">${q ? 'No matching routines found.' : 'No saved routines yet. Build one above and save it!'}</p>`;
      return;
    }

    list.innerHTML = filtered.map(r => {
      const isOpen = S.ui.openRoutines[r.id];
      const dur = sumSecs(r.items);
      return `<div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="cursor-pointer flex-1" onclick="rh.toggleRoutineDetails('${r.id}')">
            <h4 class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              ${esc(r.name)}
              <i class="fa-solid fa-chevron-down text-[10px] text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}"></i>
            </h4>
            <div class="text-[11px] text-slate-400 mt-0.5">${r.items.length} exercises • ~${fmtMin(dur)}</div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="rh.loadRoutine('${r.id}')" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition">Edit / Load</button>
            <button onclick="rh.dupRoutine('${r.id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition" title="Duplicate"><i class="fa-solid fa-copy"></i></button>
            <button onclick="rh.delRoutine('${r.id}')" class="px-2 py-1 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 text-xs rounded-lg border border-slate-700 transition"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        ${isOpen ? `<div class="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
          ${r.items.map(i => `<div class="flex justify-between text-[11px]">
            <span>${esc(i.name)} <span class="text-slate-500">(${LABEL[i.group] || i.group})</span></span>
            <span class="text-indigo-300 font-semibold">${dose(i)}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('');
  };

  // ---------- Weekly Schedule ----------
  window.renderSchedule = function () {
    if (!ensure()) return;
    const container = $('rhSchedule');
    container.innerHTML = DAYS.map(([dayKey, dayLabel]) => {
      const assignedIds = S.sched[dayKey] || [];
      return `<div class="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <span class="font-bold text-slate-200 w-12">${dayLabel}</span>
        <div class="flex-1 flex flex-wrap gap-1.5">
          ${assignedIds.length ? assignedIds.map(rid => {
            const r = S.routines.find(x => x.id === rid);
            return r ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-[11px]">
              ${esc(r.name)}
              <button onclick="rh.unassign('${dayKey}', '${rid}')" class="hover:text-rose-300 text-[10px]"><i class="fa-solid fa-xmark"></i></button>
            </span>` : '';
          }).join('') : `<span class="text-slate-500 italic text-[11px]">Rest / Mobility free day</span>`}
        </div>
        <select onchange="rh.assign('${dayKey}', this.value); this.value='';" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none">
          <option value="">＋ Assign routine...</option>
          ${S.routines.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}
        </select>
      </div>`;
    }).join('');
  };

  // ---------- Actions (Global `rh` namespace) ----------
  window.rh = {
    pick(g) {
      S.group = g;
      renderCharacterView();
      renderLegend();
      renderPicker();
    },
    viewImg(id) {
      const e = id ? S.exercises.find(x => x.id === id) : null;
      openViewer(e ? e.img : S.ui.formImg, e ? e.name : '');
    },
    closeImg: closeViewer,
    toggleExDetails(id) {
      S.ui.openEx[id] = !S.ui.openEx[id];
      renderPicker();
    },
    newEx() {
      S.ui.editing = 'new';
      S.ui.formImg = '';
      renderPicker();
    },
    editEx(id) {
      const e = S.exercises.find(x => x.id === id);
      if (e) {
        S.ui.editing = id;
        S.ui.formImg = e.img || '';
        renderPicker();
      }
    },
    cancelExForm() {
      S.ui.editing = undefined;
      S.ui.formImg = '';
      renderPicker();
    },
    clearImage() {
      S.ui.formImg = '';
      const p = $('rhF_imgPrev');
      if (p) p.innerHTML = '';
    },
    async handleImg(e) {
      const file = e.target.files && e.target.files[0];
      if (file) {
        try {
          S.ui.formImg = await readImage(file);
          const p = $('rhF_imgPrev');
          if (p) p.innerHTML = prevHTML();
        } catch (err) {
          toast('Failed to load image');
        }
      }
    },
    saveExForm(id) {
      const name = ($('rhF_name').value || '').trim();
      if (!name) return toast('Please enter an exercise name');
      const sets = parseInt($('rhF_sets').value, 10) || 1;
      const reps = parseInt($('rhF_reps').value, 10) || 1;
      const unit = $('rhF_unit').value;
      const rest = parseInt($('rhF_rest').value, 10) || 0;
      const desc = ($('rhF_desc').value || '').trim();
      const video = ($('rhF_video').value || '').trim();
      const checkboxes = document.querySelectorAll('.rhF_grp:checked');
      const also = Array.from(checkboxes).map(c => c.value).filter(g => g !== S.group);

      if (id) {
        const idx = S.exercises.findIndex(x => x.id === id);
        if (idx !== -1) {
          S.exercises[idx] = Object.assign(S.exercises[idx], { name, sets, reps, unit, rest, desc, video, also, img: S.ui.formImg });
        }
      } else {
        S.exercises.push({ id: uid(), group: S.group, name, sets, reps, unit, rest, desc, video, also, img: S.ui.formImg });
      }
      saveEx();
      S.ui.editing = undefined;
      S.ui.formImg = '';
      renderPicker();
    },
    delEx(id) {
      if (confirm('Delete this exercise suggestion?')) {
        S.exercises = S.exercises.filter(x => x.id !== id);
        saveEx();
        renderPicker();
      }
    },
    resetEx() {
      if (confirm('Reset exercise list to defaults? This keeps your saved custom routines.')) {
        S.exercises = defaultExercises();
        saveEx();
        renderPicker();
      }
    },
    addEx(id) {
      const e = S.exercises.find(x => x.id === id);
      if (e) {
        S.draft.items.push(JSON.parse(JSON.stringify(e)));
        saveDraft();
        renderWorkout();
      }
    },
    setName(val) {
      S.draft.name = val;
      saveDraft();
    },
    setBudget(val) {
      S.draft.budget = parseFloat(val) || 0;
      saveDraft();
      renderWorkout();
    },
    moveItem(idx, dir) {
      const target = idx + dir;
      if (target >= 0 && target < S.draft.items.length) {
        const temp = S.draft.items[idx];
        S.draft.items[idx] = S.draft.items[target];
        S.draft.items[target] = temp;
        saveDraft();
        renderWorkout();
      }
    },
    removeItem(idx) {
      S.draft.items.splice(idx, 1);
      saveDraft();
      renderWorkout();
    },
    clearDraft() {
      S.draft = { id: null, name: '', budget: 30, items: [] };
      saveDraft();
      $('rhName').value = '';$('rhBudget').value = 30;
      renderWorkout();
    },
    saveRoutine(asCopy) {
      const name = (S.draft.name || '').trim();
      if (!name) return toast('Please give your routine a name');
      if (!S.draft.items.length) return toast('Add at least one exercise to your routine');

      if (S.draft.id && !asCopy) {
        const idx = S.routines.findIndex(r => r.id === S.draft.id);
        if (idx !== -1) {
          S.routines[idx] = { id: S.draft.id, name, budget: S.draft.budget, items: JSON.parse(JSON.stringify(S.draft.items)) };
        }
      } else {
        const newId = uid();
        S.routines.push({ id: newId, name, budget: S.draft.budget, items: JSON.parse(JSON.stringify(S.draft.items)) });
        S.draft.id = newId;
      }
      saveRoutines();
      saveDraft();
      renderWorkout();
      renderRoutines();
      renderSchedule();
      toast('Routine saved!');
    },
    toggleRoutines() {
      S.ui.routinesOpen = !S.ui.routinesOpen;
      $('rhRoutinesBody').classList.toggle('hidden', !S.ui.routinesOpen);$('rhRoutinesChev').textContent = S.ui.routinesOpen ? '▲ Hide' : '▼ Show';
    },
    toggleRoutineDetails(id) {
      S.ui.openRoutines[id] = !S.ui.openRoutines[id];
      renderRoutines();
    },
    search(val) {
      S.ui.q = val;
      renderRoutines();
    },
    loadRoutine(id) {
      const r = S.routines.find(x => x.id === id);
      if (r) {
        S.draft = JSON.parse(JSON.stringify(r));
        saveDraft();
        $('rhName').value = S.draft.name;
        $('rhBudget').value = S.draft.budget;
        renderWorkout();
        window.scrollTo({ top: $('rhBuilderCard').offsetTop - 20, behavior: 'smooth' });
      }
    },
    dupRoutine(id) {
      const r = S.routines.find(x => x.id === id);
      if (r) {
        const dup = JSON.parse(JSON.stringify(r));
        dup.id = uid();
        dup.name += ' (Copy)';
        S.routines.push(dup);
        saveRoutines();
        renderRoutines();
      }
    },
    delRoutine(id) {
      if (confirm('Delete this saved routine?')) {
        S.routines = S.routines.filter(x => x.id !== id);
        saveRoutines();
        renderRoutines();
        renderSchedule();
      }
    },
    toggleSched() {
      S.ui.schedOpen = !S.ui.schedOpen;
      $('rhSchedBody').classList.toggle('hidden', !S.ui.schedOpen);$('rhSchedChev').textContent = S.ui.schedOpen ? '▲ Hide' : '▼ Show';
    },
    assign(dayKey, routineId) {
      if (!routineId) return;
      if (!S.sched[dayKey]) S.sched[dayKey] = [];
      if (!S.sched[dayKey].includes(routineId)) {
        S.sched[dayKey].push(routineId);
        saveSched();
        renderSchedule();
      }
    },
    unassign(dayKey, routineId) {
      if (S.sched[dayKey]) {
        S.sched[dayKey] = S.sched[dayKey].filter(id => id !== routineId);
        saveSched();
        renderSchedule();
      }
    }
  };

  // ---------- Data bridge for csv-io.js ----------
  // get()     -> { exercises, routines, sched }   (live state, or straight from storage if the tab isn't in the DOM)
  // replace() -> overwrites all three, keeps existing photos (CSV has none), saves and re-renders
  window.rehabData = {
    get() {
      if (ensure()) return { exercises: S.exercises, routines: S.routines, sched: S.sched };
      return { exercises: load(KEY.ex, []), routines: load(KEY.routines, []), sched: load(KEY.sched, {}) };
    },
    replace(d) {
      const live = ensure();
      const oldEx = live ? S.exercises : load(KEY.ex, []);
      const imgById = {};
      (oldEx || []).forEach(e => { if (e && e.img) imgById[e.id] = e.img; });

      const exercises = (d.exercises || []).filter(e => LABEL[e.group]).map(e => ({
        id: e.id || uid(), group: e.group, name: e.name,
        sets: e.sets || 1, reps: e.reps || 1, unit: e.unit === 's' ? 's' : 'r', rest: e.rest || 0,
        also: (e.also || []).filter(g => LABEL[g] && g !== e.group),
        desc: e.desc || '', video: e.video || '', img: e.img || imgById[e.id] || ''
      }));
      const routines = (d.routines || []).map(r => ({ id: r.id, name: r.name, budget: r.budget || 30, items: r.items || [] }));
      const sched = d.sched || {};

      if (!live) { store(KEY.ex, exercises); store(KEY.routines, routines); store(KEY.sched, sched); return; }

      S.exercises = exercises; S.routines = routines; S.sched = sched;
      if (S.draft.id && !routines.some(r => r.id === S.draft.id)) S.draft.id = null;
      S.ui.editing = undefined; S.ui.formImg = ''; S.ui.openEx = {}; S.ui.openRoutines = {};
      saveEx(); saveRoutines(); saveSched(); saveDraft();
      renderAll();
    }
  };
})();