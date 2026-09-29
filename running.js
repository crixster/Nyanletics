// =====================================================================
// running.js — Nyanletics: Running tab
// Owns: distance / time / pace / speed calculator (base 1 km) and the
//       Gemini workout-text estimator with a regex (offline) fallback.
// Renders itself into <div id="runTab"> — index.html only needs that
// empty div. Reuses the Gemini key + model settings page
// localStorage key: apex_run_state
// =====================================================================
(function () {
  'use strict';

  const KEY = 'apex_run_state';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = m => (typeof window.showToast === 'function' ? window.showToast(m) : console.log(m));
  const apiKey = () => (typeof window.getGeminiApiKey === 'function' ? window.getGeminiApiKey() : '');
  const NUM = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2.5 text-base text-center font-bold text-white tabular-nums focus:outline-none focus:border-emerald-500';
  const LBL = 'text-[11px] text-slate-400 font-medium block mb-1';
  const BTN = 'px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg border border-slate-700 transition text-xs';

  // ---------- state ----------
  // The calculator only stores distance (km) and pace (sec per km).
  // Time and speed are always derived from those two.
  const S = {
    ready: false,
    dist: 1,          // km  (base = 1 km)
    pace: 300,        // sec / km  (5:00 /km)
    mode: 'dist',     // when pace/speed is edited, recalc 'dist' (keep time) or 'time' (keep distance)
    easy: 480,        // sec / km used by Gemini for warm-ups etc. with no stated pace
    text: '',
    result: null,
    helpPinned: false
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ dist: S.dist, pace: S.pace, mode: S.mode, easy: S.easy, text: S.text, result: S.result })); } catch (e) { /* ignore */ } };
  const restore = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (!v) return;
      if (v.dist > 0) S.dist = v.dist;
      if (v.pace > 0) S.pace = v.pace;
      if (v.mode === 'time' || v.mode === 'dist') S.mode = v.mode;
      if (v.easy > 0) S.easy = v.easy;
      if (typeof v.text === 'string') S.text = v.text;
      if (v.result && v.result.segments) S.result = v.result;
    } catch (e) { /* ignore */ }
  };

  // ---------- formatting ----------
  const p2 = n => String(n).padStart(2, '0');
  const fmtNum = (n, d) => String(+Number(n).toFixed(d));
  function fmtDur(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`;
  }
  const fmtPace = sec => { sec = Math.round(sec); return `${Math.floor(sec / 60)}:${p2(sec % 60)}`; };
  const rng = (a, b, f) => (Math.abs(a - b) < 1e-9 || f(a) === f(b)) ? f(a) : `${f(a)} – ${f(b)}`;
  const val = id => { const el = $(id); const n = parseFloat(el && el.value); return isNaN(n) ? 0 : n; };
  function parsePaceText(t) {
    const m = String(t).trim().match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})$/);
    return m ? (+m[1]) * 60 + (+m[2]) : 0;
  }

  // ---------- skeleton ----------
  function skeleton() {
    const modeBtn = (k, label) => `<button id="rnMode_${k}" onclick="rn.setMode('${k}')" class="flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold transition">${label}</button>`;
    return `
    <div class="glass-card rounded-2xl p-4 shadow-xl border border-emerald-500/20 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2"><span class="text-lg">🏃</span>
        <div><h3 class="text-sm font-bold text-slate-100">Running</h3>
        <p class="text-[11px] text-slate-400">Pace calculator and AI workout estimator</p></div></div>
      
    </div>

    <div id="rnCalcCard" class="glass-card rounded-2xl p-4 shadow-xl border border-indigo-500/20">
      <h2 class="text-base font-bold text-slate-200 mb-3">Pace Calculator</h2>

      <div class="grid grid-cols-2 gap-3">
        <div><label class="${LBL}" for="rnDist">Distance (km)</label>
          <input id="rnDist" type="number" inputmode="decimal" step="any" min="0" oninput="rn.onDist()" onblur="rn.norm()" class="${NUM}"></div>
        <div><label class="${LBL}" for="rnSpeed">Speed (km/h)</label>
          <input id="rnSpeed" type="number" inputmode="decimal" step="any" min="0" oninput="rn.onSpeed()" onblur="rn.norm()" class="${NUM}"></div>
      </div>

      <div class="flex flex-wrap gap-1.5 mt-2">
        ${[['1 km', 1], ['5K', 5], ['10K', 10], ['Half', 21.0975], ['Marathon', 42.195]].map(p =>
          `<button onclick="rn.preset(${p[1]})" class="${BTN}">${p[0]}</button>`).join('')}
      </div>

      <div class="mt-3"><label class="${LBL}">Time (h : min : sec)</label>
        <div class="grid grid-cols-3 gap-2">
          <input id="rnH" type="number" inputmode="numeric" min="0" placeholder="h" aria-label="Hours" oninput="rn.onTime()" onblur="rn.norm()" class="${NUM}">
          <input id="rnM" type="number" inputmode="numeric" min="0" placeholder="min" aria-label="Minutes" oninput="rn.onTime()" onblur="rn.norm()" class="${NUM}">
          <input id="rnS" type="number" inputmode="decimal" min="0" placeholder="sec" aria-label="Seconds" oninput="rn.onTime()" onblur="rn.norm()" class="${NUM}">
        </div></div>

      <div class="mt-3"><label class="${LBL}">Pace (min : sec per km)</label>
        <div class="grid grid-cols-2 gap-2">
          <input id="rnPM" type="number" inputmode="numeric" min="0" placeholder="min" aria-label="Pace minutes" oninput="rn.onPace()" onblur="rn.norm()" class="${NUM}">
          <input id="rnPS" type="number" inputmode="numeric" min="0" placeholder="sec" aria-label="Pace seconds" oninput="rn.onPace()" onblur="rn.norm()" class="${NUM}">
        </div></div>

      <div class="mt-3 flex items-center gap-2">
        <span class="text-[11px] text-slate-400 flex-shrink-0">Changing pace or speed recalculates</span>
        <div class="flex flex-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">${modeBtn('dist', 'Distance')}${modeBtn('time', 'Time')}</div>
      </div>
      <p class="text-[11px] text-slate-500 mt-2">Changing distance updates time. Changing time updates distance. Pace and speed always stay in sync.</p>
    </div>

    <div id="rnWorkoutCard" class="glass-card rounded-2xl p-4 shadow-xl border border-emerald-500/20">
          <div class="flex items-center gap-2 mb-1">
        <h2 class="text-base font-bold text-slate-200">Workout Estimator</h2>
        <div id="rnHelpWrap" class="relative inline-block" onmouseenter="rn.helpHover(true)" onmouseleave="rn.helpHover(false)">
          <button id="rnHelpBtn" type="button" onclick="rn.helpToggle(event)" aria-label="Formatting guide" aria-expanded="false" aria-controls="rnHelp"
            class="w-4 h-4 p-0 rounded-full border border-slate-500 text-[9px] leading-none font-bold text-slate-400 hover:text-emerald-300 hover:border-emerald-400 focus:outline-none inline-flex items-center justify-center">?</button>
          <div id="rnHelp" role="tooltip" class="hidden absolute left-0 top-full pt-2 z-40 w-72 max-w-[calc(100vw-3rem)]">
            <div class="bg-slate-950 border border-slate-700 rounded-xl shadow-2xl p-3 text-[11px] text-slate-200">
              <p class="font-bold text-slate-100 mb-1.5">How to write the workout</p>
              <p class="text-slate-300 text-[10px] mb-1.5">Any wording works with Gemini. The backup regex parser needs this layout:</p>
              <ul class="space-y-1 list-disc pl-3 text-slate-300 text-[10px] leading-tight">
                <li>One step per line, or separate steps with commas, <code>+</code> or <code>then</code>.</li>
                <li>Distance with a unit: <code>1km</code>, <code>500m</code>, <code>5k</code>, <code>3mi</code>. Ranges: <code>1-1.5km</code>.</li>
                <li>Time steps: <code>10 min easy</code>, <code>90s</code>, <code>2 min rest</code>. Write rests this way, not as 2:00.</li>
                <li>Pace as min:sec per km, after <code>@</code> or in brackets: <code>@ 4:50</code> or <code>(4:50-4:15)</code>.</li>
                <li>Rounds before the step: <code>3-5 x 1km</code>, <code>4 rounds 400m</code>, <code>3x1km</code>.</li>
                <li>A rounds step repeats every step after it until you write <code>then</code> or a warm-up/cool-down.</li>
                <li>No pace given? The easy pace is used. Rests and walks count as time only.</li>
              </ul>
              <button type="button" onclick="rn.example()" class="mt-2 text-[10px] text-emerald-300 hover:text-emerald-200 underline">Insert example</button>
            </div>
          </div>
        </div>
      </div>


      <p class="text-[11px] text-slate-400 mb-3">Paste a workout to estimate its total distance and time.</p>
      <textarea id="rnText" rows="6" oninput="rn.onText(this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500" placeholder="One step per line (or separated by commas):&#10;1-1.5km easy warm up&#10;3-5 x 1km @ 4:50-4:15&#10;500m float @ 5:00-7:00&#10;then 1.5km cooldown"></textarea>
      
      <div class="mt-3">
        <div class="w-24"><label class="${LBL}" for="rnEasy">Easy pace /km</label>
          <input id="rnEasy" type="text" inputmode="text" placeholder="8:00" onchange="rn.onEasy(this.value)" class="${NUM} !text-sm"></div>
        <p class="text-[10px] text-slate-500 mt-1.5">Easy pace is used for warm-ups, cool-downs and any step without a pace.</p>
      </div>
      <div class="flex gap-2 mt-3">
        <button id="rnGo" onclick="rn.estimate()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition">Estimate</button>
        <button onclick="rn.clearText()" class="${BTN} !py-2.5 flex-shrink-0">Clear</button>
      </div>



      <div id="rnStatus" class="hidden mt-3 text-xs rounded-lg border px-3 py-2"></div>
      <div id="rnResult" class="mt-3"></div>
    </div>`;
  }

  // ---------- init ----------
  function ensure() {
    const root = $('runTab');
    if (!root || S.ready) return !!root;
    restore();
    root.innerHTML = skeleton();
    $('rnText').value = S.text;
    $('rnEasy').value = fmtPace(S.easy);
    document.addEventListener('click', e => {
      const w = $('rnHelpWrap');
      if (S.helpPinned && w && !w.contains(e.target)) { S.helpPinned = false; showHelp(false); }
    });
    S.ready = true;
    return true;
  }
  window.initRunningUI = function () { if (ensure()) window.renderRunning(); };
  window.renderRunning = function () {
    if (!ensure()) return;
    fill(null); renderMode(); renderResult();
  };

  // ---------- calculator ----------
  function fill(src) {
    if (src !== 'dist') $('rnDist').value = fmtNum(S.dist, 3);
    if (src !== 'time') {
      const t = Math.round(S.dist * S.pace);
      $('rnH').value = Math.floor(t / 3600);
      $('rnM').value = Math.floor((t % 3600) / 60);
      $('rnS').value = t % 60;
    }
    if (src !== 'pace') {
      const p = Math.round(S.pace);
      $('rnPM').value = Math.floor(p / 60);
      $('rnPS').value = p % 60;
    }
    if (src !== 'speed') $('rnSpeed').value = fmtNum(3600 / S.pace, 2);
  }
  function renderMode() {
    ['dist', 'time'].forEach(k => {
      $('rnMode_' + k).className = 'flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold transition ' +
        (S.mode === k ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white');
    });
  }
  function applyRate(p) {
    if (S.mode === 'dist') { const t = S.dist * S.pace; S.pace = p; S.dist = t / p; }
    else S.pace = p;
  }
  const done = src => { fill(src); save(); };

  const rn = window.rn = {
    onDist() { const d = val('rnDist'); if (!(d > 0)) return; S.dist = d; done('dist'); },
    onTime() {
      const t = val('rnH') * 3600 + val('rnM') * 60 + val('rnS');
      if (!(t > 0)) return; S.dist = t / S.pace; done('time');
    },
    onPace() {
      const p = val('rnPM') * 60 + val('rnPS');
      if (!(p > 0)) return; applyRate(p); done('pace');
    },
    onSpeed() { const k = val('rnSpeed'); if (!(k > 0)) return; applyRate(3600 / k); done('speed'); },
    norm() { fill(null); },                       // tidy fields (e.g. 75 min -> 1:15:00) when leaving one
    preset(km) { S.dist = km; done(null); },
    setMode(m) { S.mode = m; renderMode(); save(); },

    // ---------- workout estimator ----------
    onText(v) { S.text = v; save(); },
    onEasy(v) {
      const p = parsePaceText(v);
      if (p > 0) S.easy = p; else toast('Use pace like 6:00');
      $('rnEasy').value = fmtPace(S.easy); save();
    },
    clearText() { S.text = ''; S.result = null; $('rnText').value = ''; setStatus(''); renderResult(); save(); },
   

    async estimate() {
      const text = S.text.trim();
      if (!text) return toast('Paste a workout first');
            if (!apiKey()) return fallback('No Gemini API key (add one in Settings). Using regex parser.');
      const btn = $('rnGo'); btn.disabled = true;
      const model = (typeof cachedWorkingGeminiModel !== 'undefined' && cachedWorkingGeminiModel) ||
                    (typeof GEMINI_PREFERRED_MODEL !== 'undefined' && GEMINI_PREFERRED_MODEL) || 'Gemini';
      setStatus(`Estimating with ${model}…`, 'busy');
      try {
        const payload = {
          contents: [{ role: 'user', parts: [{ text: buildPrompt(text) }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        };
        const { modelId, data } = await window.callGeminiVision(apiKey(), payload);
        const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
        const raw = parts.filter(p => !p.thought && p.text).map(p => p.text).join('');
        S.result = normalise(parseJson(raw), modelId);
        save(); setStatus(''); renderResult();
      } catch (err) {
        console.error('running: Gemini estimate failed', err);
        fallback('Gemini failed (' + (err.message || 'unknown error') + '). Using regex parser.');
      } finally { btn.disabled = false; }
    },

    
    helpToggle(e) { e.stopPropagation(); S.helpPinned = !S.helpPinned; showHelp(S.helpPinned); },
    helpHover(on) { if (!S.helpPinned) showHelp(on); },

    example() {
      S.text = '1-1.5km easy warm up\n3-5 x 1km @ 4:50-4:15\n500m float @ 5:00-7:00\nthen 1.5km cooldown';
      $('rnText').value = S.text; save();
    },

    useEstimate() {
      const r = S.result; if (!r) return;
      const d = (r.totals.dMin + r.totals.dMax) / 2, t = (r.totals.tMin + r.totals.tMax) / 2;
      if (!(d > 0 && t > 0)) return;
      S.dist = d; S.pace = t / d; fill(null); save(); toast('Loaded into calculator');
      $('rnCalcCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  function buildPrompt(text) {
    return `You parse running workouts. Break the workout below into ordered segments and estimate distance and duration for each.

Rules:
- Distances are in km (500m = 0.5, 1 mile = 1.609).
- Ranges ("3-5 rounds", "1km - 1.5km", pace "4:50-4:15") become min and max. min is the smallest plausible value, max the largest, always min <= max, for both distance and duration.
- Create one segment per workout component. A rounds count ("3-5 rounds", "4 x") applies to that component AND every component after it up to the word "then" or a cool-down, so those repeat together. Multiply each repeated component by the round count so segment totals already include repeats, and say so in the label (e.g. "3-5 x 1 km at 4:15-4:50 /km").
- Pace is minutes:seconds per km. Duration = distance x pace. If a segment is time-based (e.g. "10 min easy"), derive distance from the pace.
- When no pace is given (warm-up, cool-down, easy, recovery, Z1/Z2), use ${fmtPace(S.easy)} per km.
- Rest or float segments count as distance and time if they are covered (jog/float), and as time only if stationary.
- Keep all assumptions short.

Return ONLY JSON with this shape, no markdown:
{"segments":[{"label":string,"distance_km":{"min":number,"max":number},"duration_sec":{"min":number,"max":number},"note":string}],"assumptions":[string]}

Workout:
"""
${text}
"""`;
  }

  function parseJson(raw) {
    let s = String(raw || '').replace(/```json|```/gi, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('Gemini did not return usable JSON');
    return JSON.parse(s.slice(a, b + 1));
  }

  // Totals are summed here rather than trusted from the model, so the maths is always consistent.
  function normalise(j, modelId) {
    const n = v => (typeof v === 'number' && isFinite(v) && v >= 0) ? v : 0;
    const pair = o => { const a = n(o && o.min), b = n(o && o.max) || a; return [Math.min(a, b), Math.max(a, b)]; };
    const segments = (Array.isArray(j.segments) ? j.segments : []).map(g => {
      const [dMin, dMax] = pair(g.distance_km), [tMin, tMax] = pair(g.duration_sec);
      return { label: String(g.label || 'Segment'), note: String(g.note || ''), dMin, dMax, tMin, tMax };
    }).filter(g => g.dMax > 0 || g.tMax > 0);
    if (!segments.length) throw new Error('No segments found in that workout');
    const sum = k => segments.reduce((a, g) => a + g[k], 0);
    return {
      model: modelId, segments,
      assumptions: (Array.isArray(j.assumptions) ? j.assumptions : []).map(String).slice(0, 8),
      totals: { dMin: sum('dMin'), dMax: sum('dMax'), tMin: sum('tMin'), tMax: sum('tMax') }
    };
  }


  // ---------- Regex fallback parser ----------
  // Runs when Gemini is unavailable. Produces the same shape as Gemini's JSON,
  // so normalise() and renderResult() handle both.
  const UNIT_KM = { km: 1, k: 1, m: 0.001, mi: 1.609344, mile: 1.609344, miles: 1.609344 };
  const UNIT_SEC = { h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, s: 1, sec: 1, secs: 1, second: 1, seconds: 1 };
  const RE = {
    then: /\bthen\b|->|→/gi,
    pace: /[@(]?\s*(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?\s*\)?\s*(?:\/\s*km|per\s*km|min\s*\/\s*km)?/i,
    roundsA: /(?<![\d.:])(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:x|×|rounds?|reps?|sets?|times|intervals?|repeats?)(?![a-z])/i,
    roundsB: /(?<![a-z\d])[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?(?![\d.])/i,
    distRange: /(?<![\w.])(\d+(?:\.\d+)?)\s*(km|k|miles?|mi|m)?\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)\s*(km|k|miles?|mi|m)(?![a-z])/i,
    dist: /(?<![\w.])(\d+(?:\.\d+)?)\s*(km|k|miles?|mi|m)(?![a-z])/i,
    dur: /(?<![\w.])(\d+(?:\.\d+)?)(?:\s*(hours?|hrs?|h|minutes?|mins?|seconds?|secs?|s)?\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|h|minutes?|mins?|seconds?|secs?|s)(?![a-z])/i,
    stationary: /\b(rest|standing|stationary|walk|walking|stretch|drills?)\b/i,
    warmCool: /warm|cool/i
  };
  const range = (a, b) => { a = +a; b = b == null || b === '' ? a : +b; return [Math.min(a, b), Math.max(a, b)]; };
  const clean = t => t.replace(/\s+/g, ' ').replace(/^[\s\-•*·:]+|[\s\-•*·:,]+$/g, '').trim();

  function regexChunk(chunk) {
    let t = chunk, hasPace = false, pace = [S.easy, S.easy], rounds = null, dist = null, dur = null;

    let m = t.match(RE.pace);
    if (m) {
      const a = +m[1] * 60 + +m[2], b = m[3] != null ? +m[3] * 60 + +m[4] : a;
      pace = [Math.min(a, b), Math.max(a, b)]; hasPace = true; t = t.replace(m[0], ' ');
    }
    m = t.match(RE.roundsA) || t.match(RE.roundsB);
    if (m) { rounds = range(m[1], m[2]); t = t.replace(m[0], ' '); }

    m = t.match(RE.distRange);
    if (m) {
      const u1 = UNIT_KM[(m[2] || m[4]).toLowerCase()], u2 = UNIT_KM[m[4].toLowerCase()];
      dist = range(+m[1] * u1, +m[3] * u2);
    } else if ((m = t.match(RE.dist))) {
      const v = +m[1] * UNIT_KM[m[2].toLowerCase()]; dist = [v, v];
    }
    if (!dist) {
      m = t.match(RE.dur);
      if (m) {
        const u1 = UNIT_SEC[(m[2] || m[4]).toLowerCase()], u2 = UNIT_SEC[m[4].toLowerCase()];
        dur = range(+m[1] * u1, m[3] != null ? +m[3] * u2 : null);
      }
    }
    if (!dist && !dur) return null;

    const stationary = RE.stationary.test(chunk);
    let d, tm, note = [];
    if (dist) {
      d = dist; tm = [dist[0] * pace[0], dist[1] * pace[1]];
    } else {
      tm = dur;
      d = stationary ? [0, 0] : [dur[0] / pace[1], dur[1] / pace[0]];
    }
    if (!hasPace && !stationary) note.push('easy pace assumed');
    if (dur && stationary) note.push('time only, no distance counted');
    return { rounds, d, tm, note: note.join(', '), label: clean(chunk) };
  }

  function regexParse(text) {
    // "1,5km" (decimal comma) -> "1.5km", then split into steps
    const src = text.replace(/(\d),(\d)/g, '$1.$2');
    const tokens = src.split(new RegExp(`(${RE.then.source})|[\\n;,+&]+`, 'i')).filter(x => x !== undefined && x.trim());
    const segments = [], skipped = [], notes = [];
    let block = null;   // active rounds block: [min, max]

    tokens.forEach(tok => {
      if (new RegExp(`^(?:${RE.then.source})$`, 'i').test(tok.trim())) { block = null; return; }
      const raw = tok.replace(/^\s*[-•*]\s+/, '');
      if (!clean(raw)) return;
      const g = regexChunk(raw);
      if (!g) { skipped.push(clean(raw)); return; }

      let mult = null, label = g.label;
      if (g.rounds) { block = g.rounds; mult = g.rounds; }
      else if (block && !RE.warmCool.test(raw)) { mult = block; label = `${rng(block[0], block[1], String)} rounds: ${label}`; }
      else block = null;

      const [rLo, rHi] = mult || [1, 1];
      segments.push({
        label,
        distance_km: { min: g.d[0] * rLo, max: g.d[1] * rHi },
        duration_sec: { min: g.tm[0] * rLo, max: g.tm[1] * rHi },
        note: g.note
      });
    });

    if (!segments.length) throw new Error('Could not find any distances or times in that text. Check the formatting guide.');
    notes.push('Estimated by the offline regex parser, so check that every step below looks right.');
    notes.push('Lowest total = fewest rounds at the fastest pace. Highest = most rounds at the slowest pace.');
    if (skipped.length) notes.push('Could not read: ' + skipped.map(x => '"' + x + '"').join(', '));
    return { segments, assumptions: notes };
  }

  function fallback(prefix) {
    try {
      S.result = normalise(regexParse(S.text), 'Regex parser (offline)');
      save(); renderResult();
      setStatus(prefix, prefix ? 'warn' : '');
    } catch (err) {
      S.result = null; save(); renderResult();
      setStatus((prefix ? prefix + ' ' : '') + err.message, 'error');
    }
  }

  function showHelp(on) {
    const h = $('rnHelp'), b = $('rnHelpBtn');
    if (h) h.classList.toggle('hidden', !on);
    if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function setStatus(msg, kind) {
    const el = $('rnStatus');
    if (!msg) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.className = 'mt-3 text-xs rounded-lg border px-3 py-2 ' + (kind === 'error'
      ? 'border-rose-500/50 text-rose-300 bg-rose-500/10'
      : kind === 'warn' ? 'border-amber-500/40 text-amber-200 bg-amber-500/10'
      : 'border-emerald-500/30 text-slate-200 bg-slate-900/80');
    if (kind === 'busy') el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5 text-emerald-400"></i>' + esc(msg);
    else el.textContent = msg;
  }

  function renderResult() {
    const box = $('rnResult'), r = S.result;
    if (!r) { box.innerHTML = ''; return; }
    const t = r.totals, dMid = (t.dMin + t.dMax) / 2, tMid = (t.tMin + t.tMax) / 2;
    const dF = v => fmtNum(v, 2) + ' km';
    box.innerHTML = `
      <div class="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3">
        <div class="grid grid-cols-2 gap-3">
          <div><div class="text-[11px] text-slate-400">Total distance</div>
            <div class="text-lg font-extrabold text-emerald-400 tabular-nums">${rng(t.dMin, t.dMax, dF)}</div></div>
          <div><div class="text-[11px] text-slate-400">Total time</div>
            <div class="text-lg font-extrabold text-emerald-400 tabular-nums">${rng(t.tMin, t.tMax, fmtDur)}</div></div>
        </div>
        <p class="text-[11px] text-slate-400 mt-2">Midpoint: ${dF(dMid)} in ${fmtDur(tMid)}${dMid > 0 ? ` (${fmtPace(tMid / dMid)} /km average)` : ''}</p>
        <button onclick="rn.useEstimate()" class="${BTN} mt-2">Load midpoint into calculator</button>
      </div>
      <div class="space-y-1.5 mt-2">${r.segments.map(g => `
        <div class="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2">
          <div class="text-xs font-semibold text-slate-100">${esc(g.label)}</div>
          <div class="text-[11px] text-slate-400 tabular-nums">${rng(g.dMin, g.dMax, dF)} · ${rng(g.tMin, g.tMax, fmtDur)}</div>
          ${g.note ? `<div class="text-[11px] text-slate-500 mt-0.5">${esc(g.note)}</div>` : ''}
        </div>`).join('')}</div>
      ${r.assumptions.length ? `<ul class="mt-2 space-y-0.5">${r.assumptions.map(a => `<li class="text-[11px] text-slate-500">• ${esc(a)}</li>`).join('')}</ul>` : ''}
      <p class="text-[10px] text-slate-600 mt-2">Estimated by ${esc(r.model || 'Gemini')}. Treat as a guide, not a measurement.</p>`;
  }
})();
