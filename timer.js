// =====================================================================
// timer.js — Nyanletics: Timer & EMOM Tab
// Owns: Stopwatch (with splits), Countdown, Interval Timer, and
//       EMOM / E2MOM / EXMOM modes with Web Audio sound cues.
// =====================================================================
(function () {
  'use strict';

  let mode = 'emom'; // 'stopwatch', 'countdown', 'interval', 'emom'
  let audioCtx = null;

  // Global State
  const state = {
    stopwatch: { running: false, startTime: 0, elapsed: 0, splits: [], timerId: null },
    countdown: { running: false, totalSecs: 180, remaining: 180, timerId: null },
    interval: { running: false, workSecs: 40, restSecs: 20, rounds: 8, curRound: 1, isWork: true, remaining: 40, timerId: null },
    emom: { running: false, intervalSecs: 60, totalRounds: 10, curRound: 1, remaining: 60, timerId: null }
  };

  const $ = id => document.getElementById(id);

  function playBeep(freq = 800, duration = 0.15) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  function fmtTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${m}:${s}<span class="text-sm opacity-70">.${cs}</span>`;
  }

  function fmtSecs(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function setTimerMode(newMode) {
    mode = newMode;
    renderTimerUI();
  }

  function renderTimerUI() {
    const root = $('timerTab');
    if (!root) return;

    const navClass = m => m === mode
      ? 'flex-1 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white shadow-md transition-all'
      : 'flex-1 py-2 text-xs font-semibold rounded-lg text-slate-300 hover:text-white transition-all';

    root.innerHTML = `
      <div class="glass-card rounded-2xl p-4 shadow-xl border border-indigo-500/20 space-y-4">
        <!-- Sub Mode Selector -->
        <div class="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-center gap-1">
          <button onclick="window.nyanTimer.setMode('emom')" class="${navClass('emom')}">EMOM / EXMOM</button>
          <button onclick="window.nyanTimer.setMode('interval')" class="${navClass('interval')}">Interval / HIIT</button>
          <button onclick="window.nyanTimer.setMode('countdown')" class="${navClass('countdown')}">Countdown</button>
          <button onclick="window.nyanTimer.setMode('stopwatch')" class="${navClass('stopwatch')}">Stopwatch</button>
        </div>

        <div id="timerDisplayArea">
          ${renderModeContent()}
        </div>
      </div>
    `;
  }

  function renderModeContent() {
    if (mode === 'stopwatch') return renderStopwatch();
    if (mode === 'countdown') return renderCountdown();
    if (mode === 'interval') return renderInterval();
    if (mode === 'emom') return renderEMOM();
    return '';
  }

  // ---------- 1. Stopwatch & Split Timer ----------
  function renderStopwatch() {
    const sw = state.stopwatch;
    return `
      <div class="text-center space-y-5">
        <div class="text-5xl font-black font-mono text-indigo-400 tracking-wider my-4">
          ${fmtTime(sw.elapsed)}
        </div>
        <div class="flex gap-2 justify-center">
          <button onclick="window.nyanTimer.toggleStopwatch()" class="px-6 py-2.5 rounded-xl text-xs font-bold ${sw.running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-md transition">
            ${sw.running ? 'Pause' : 'Start'}
          </button>
          <button onclick="window.nyanTimer.splitStopwatch()" ${!sw.running ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition disabled:opacity-40">
            Split
          </button>
          <button onclick="window.nyanTimer.resetStopwatch()" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Reset
          </button>
        </div>
        ${sw.splits.length ? `
          <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-800 max-h-48 overflow-y-auto text-xs space-y-1">
            ${sw.splits.map((s, i) => `
              <div class="flex justify-between text-slate-300 border-b border-slate-800/60 pb-1">
                <span class="font-bold text-slate-500">Split #${sw.splits.length - i}</span>
                <span class="font-mono text-emerald-400">${fmtTime(s.diff)}</span>
                <span class="font-mono text-slate-400">Total: ${fmtTime(s.total)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ---------- 2. Countdown Timer ----------
  function renderCountdown() {
    const cd = state.countdown;
    const m = Math.floor(cd.totalSecs / 60);
    const s = cd.totalSecs % 60;
    return `
      <div class="text-center space-y-4">
        <div class="text-6xl font-black font-mono text-emerald-400 tracking-wider my-4">
          ${fmtSecs(cd.remaining)}
        </div>
        
        <!-- Min : Sec Custom Input -->
        <div class="flex items-center justify-center gap-2 max-w-xs mx-auto text-xs">
          <div class="flex-1">
            <label class="text-[11px] text-slate-400 block mb-1">Minutes</label>
            <input type="number" min="0" value="${m}" onchange="window.nyanTimer.updateCDCfg('min', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-white font-medium">
          </div>
          <span class="text-slate-500 font-bold mt-4">:</span>
          <div class="flex-1">
            <label class="text-[11px] text-slate-400 block mb-1">Seconds</label>
            <input type="number" min="0" max="59" value="${s}" onchange="window.nyanTimer.updateCDCfg('sec', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-white font-medium">
          </div>
        </div>

        <div class="grid grid-cols-5 gap-1.5 max-w-xs mx-auto text-xs pt-1">
          <button onclick="window.nyanTimer.setCDPreset(30)" class="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 font-medium">30s</button>
          <button onclick="window.nyanTimer.setCDPreset(60)" class="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 font-medium">1m</button>
          <button onclick="window.nyanTimer.setCDPreset(120)" class="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 font-medium">2m</button>
          <button onclick="window.nyanTimer.setCDPreset(180)" class="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 font-medium">3m</button>
          <button onclick="window.nyanTimer.setCDPreset(300)" class="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 font-medium">5m</button>
        </div>

        <div class="flex gap-2 justify-center pt-2">
          <button onclick="window.nyanTimer.toggleCountdown()" class="px-8 py-2.5 rounded-xl text-xs font-bold ${cd.running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-md transition">
            ${cd.running ? 'Pause' : 'Start'}
          </button>
          <button onclick="window.nyanTimer.resetCountdown()" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Reset
          </button>
        </div>
      </div>
    `;
  }

  // ---------- 3. Interval Timer (Work / Rest) ----------
  function renderInterval() {
    const it = state.interval;
    const wM = Math.floor(it.workSecs / 60);
    const wS = it.workSecs % 60;
    const rM = Math.floor(it.restSecs / 60);
    const rS = it.restSecs % 60;

    return `
      <div class="space-y-4 text-center">
        <!-- Work / Rest Min : Sec Inputs -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-left max-w-md mx-auto bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div>
            <label class="text-[11px] text-emerald-400 font-bold block mb-1">Work (Min : Sec)</label>
            <div class="flex items-center gap-1">
              <input type="number" min="0" value="${wM}" onchange="window.nyanTimer.updateIntervalCfg('workMin', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
              <span class="text-slate-500 font-bold">:</span>
              <input type="number" min="0" max="59" value="${wS}" onchange="window.nyanTimer.updateIntervalCfg('workSec', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
            </div>
          </div>

          <div>
            <label class="text-[11px] text-amber-400 font-bold block mb-1">Rest (Min : Sec)</label>
            <div class="flex items-center gap-1">
              <input type="number" min="0" value="${rM}" onchange="window.nyanTimer.updateIntervalCfg('restMin', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
              <span class="text-slate-500 font-bold">:</span>
              <input type="number" min="0" max="59" value="${rS}" onchange="window.nyanTimer.updateIntervalCfg('restSec', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
            </div>
          </div>

          <div>
            <label class="text-[11px] text-indigo-400 font-bold block mb-1">Rounds</label>
            <input type="number" min="1" value="${it.rounds}" onchange="window.nyanTimer.updateIntervalCfg('rounds', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium mt-0.5">
          </div>
        </div>

        <div class="py-2">
          <span class="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${it.isWork ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
            ${it.isWork ? '🔥 WORK' : '💤 REST'} — Round ${it.curRound} / ${it.rounds}
          </span>
          <div class="text-6xl font-black font-mono my-2 ${it.isWork ? 'text-emerald-400' : 'text-amber-400'}">
            ${fmtSecs(it.remaining)}
          </div>
        </div>

        <div class="flex gap-2 justify-center">
          <button onclick="window.nyanTimer.toggleInterval()" class="px-8 py-2.5 rounded-xl text-xs font-bold ${it.running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-md transition">
            ${it.running ? 'Pause' : 'Start Interval'}
          </button>
          <button onclick="window.nyanTimer.resetInterval()" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Reset
          </button>
        </div>
      </div>
    `;
  }

  // ---------- 4. EMOM / E2MOM / EXMOM ----------
  function renderEMOM() {
    const em = state.emom;
    const m = Math.floor(em.intervalSecs / 60);
    const s = em.intervalSecs % 60;

    return `
      <div class="space-y-4 text-center">
        <!-- EMOM Preset Shortcuts -->
        <div class="flex gap-1.5 justify-center text-xs">
          <button onclick="window.nyanTimer.setEMOMPreset(60, 10)" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-indigo-300 border border-slate-700 font-semibold">EMOM (1m)</button>
          <button onclick="window.nyanTimer.setEMOMPreset(120, 8)" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-indigo-300 border border-slate-700 font-semibold">E2MOM (2m)</button>
          <button onclick="window.nyanTimer.setEMOMPreset(180, 6)" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-indigo-300 border border-slate-700 font-semibold">E3MOM (3m)</button>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs text-left max-w-xs mx-auto bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">Every (Min : Sec)</label>
            <div class="flex items-center gap-1">
              <input type="number" min="0" value="${m}" onchange="window.nyanTimer.updateEMOMCfg('min', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
              <span class="text-slate-500 font-bold">:</span>
              <input type="number" min="0" max="59" value="${s}" onchange="window.nyanTimer.updateEMOMCfg('sec', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
            </div>
          </div>
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">Total Rounds</label>
            <input type="number" min="1" value="${em.totalRounds}" onchange="window.nyanTimer.updateEMOMCfg('rounds', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-white font-medium mt-0.5">
          </div>
        </div>

        <div class="py-2">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Round <span class="text-indigo-400 text-sm font-black">${em.curRound}</span> of <span class="text-slate-300">${em.totalRounds}</span>
          </div>
          <div class="text-6xl font-black font-mono text-indigo-400 my-2">
            ${fmtSecs(em.remaining)}
          </div>
        </div>

        <div class="flex gap-2 justify-center">
          <button onclick="window.nyanTimer.toggleEMOM()" class="px-8 py-2.5 rounded-xl text-xs font-bold ${em.running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white shadow-md transition">
            ${em.running ? 'Pause' : 'Start EMOM'}
          </button>
          <button onclick="window.nyanTimer.resetEMOM()" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Reset
          </button>
        </div>
      </div>
    `;
  }

  // Global Engine Controls
  window.nyanTimer = {
    setMode: setTimerMode,

    // Stopwatch
    toggleStopwatch() {
      const sw = state.stopwatch;
      sw.running = !sw.running;
      if (sw.running) {
        sw.startTime = Date.now() - sw.elapsed;
        sw.timerId = setInterval(() => {
          sw.elapsed = Date.now() - sw.startTime;
          renderTimerUI();
        }, 30);
      } else {
        clearInterval(sw.timerId);
        renderTimerUI();
      }
    },
    splitStopwatch() {
      const sw = state.stopwatch;
      if (!sw.running) return;
      const prevTotal = sw.splits.length ? sw.splits[0].total : 0;
      sw.splits.unshift({ total: sw.elapsed, diff: sw.elapsed - prevTotal });
      renderTimerUI();
    },
    resetStopwatch() {
      const sw = state.stopwatch;
      clearInterval(sw.timerId);
      sw.running = false;
      sw.elapsed = 0;
      sw.splits = [];
      renderTimerUI();
    },

    // Countdown
    setCDPreset(secs) {
      const cd = state.countdown;
      this.resetCountdown();
      cd.totalSecs = secs;
      cd.remaining = secs;
      renderTimerUI();
    },
    // Countdown Config Handler
    updateCDCfg(unit, val) {
      const cd = state.countdown;
      let m = Math.floor(cd.totalSecs / 60);
      let s = cd.totalSecs % 60;
      if (unit === 'min') m = Math.max(0, parseInt(val) || 0);
      if (unit === 'sec') s = Math.min(59, Math.max(0, parseInt(val) || 0));
      cd.totalSecs = m * 60 + s;
      this.resetCountdown();
    },
    toggleCountdown() {
      const cd = state.countdown;
      cd.running = !cd.running;
      if (cd.running) {
        cd.timerId = setInterval(() => {
          cd.remaining--;
          if (cd.remaining <= 3 && cd.remaining > 0) playBeep(600, 0.1);
          if (cd.remaining <= 0) {
            playBeep(1200, 0.5);
            this.resetCountdown();
          } else {
            renderTimerUI();
          }
        }, 1000);
      } else {
        clearInterval(cd.timerId);
        renderTimerUI();
      }
    },
    resetCountdown() {
      const cd = state.countdown;
      clearInterval(cd.timerId);
      cd.running = false;
      cd.remaining = cd.totalSecs;
      renderTimerUI();
    },

    // Interval Config Handler
    updateIntervalCfg(field, val) {
      const it = state.interval;
      let wM = Math.floor(it.workSecs / 60);
      let wS = it.workSecs % 60;
      let rM = Math.floor(it.restSecs / 60);
      let rS = it.restSecs % 60;

      const n = Math.max(0, parseInt(val) || 0);

      if (field === 'workMin') wM = n;
      if (field === 'workSec') wS = Math.min(59, n);
      if (field === 'restMin') rM = n;
      if (field === 'restSec') rS = Math.min(59, n);
      if (field === 'rounds') it.rounds = Math.max(1, n);

      it.workSecs = wM * 60 + wS;
      it.restSecs = rM * 60 + rS;

      this.resetInterval();
    },
    toggleInterval() {
      const it = state.interval;
      it.running = !it.running;
      if (it.running) {
        it.timerId = setInterval(() => {
          it.remaining--;
          if (it.remaining <= 3 && it.remaining > 0) playBeep(700, 0.1);
          if (it.remaining <= 0) {
            playBeep(1000, 0.3);
            if (it.isWork) {
              it.isWork = false;
              it.remaining = it.restSecs;
            } else {
              it.isWork = true;
              it.curRound++;
              if (it.curRound > it.rounds) {
                playBeep(1400, 0.6);
                this.resetInterval();
                return;
              }
              it.remaining = it.workSecs;
            }
          }
          renderTimerUI();
        }, 1000);
      } else {
        clearInterval(it.timerId);
        renderTimerUI();
      }
    },
    resetInterval() {
      const it = state.interval;
      clearInterval(it.timerId);
      it.running = false;
      it.curRound = 1;
      it.isWork = true;
      it.remaining = it.workSecs;
      renderTimerUI();
    },

    // EMOM
    setEMOMPreset(secs, rounds) {
      const em = state.emom;
      em.intervalSecs = secs;
      em.totalRounds = rounds;
      this.resetEMOM();
    },
    // EMOM Config Handler
    updateEMOMCfg(field, val) {
      const em = state.emom;
      let m = Math.floor(em.intervalSecs / 60);
      let s = em.intervalSecs % 60;
      const n = Math.max(0, parseInt(val) || 0);

      if (field === 'min') m = n;
      if (field === 'sec') s = Math.min(59, n);
      if (field === 'rounds') em.totalRounds = Math.max(1, n);

      em.intervalSecs = m * 60 + s;
      this.resetEMOM();
    },
    toggleEMOM() {
      const em = state.emom;
      em.running = !em.running;
      if (em.running) {
        em.timerId = setInterval(() => {
          em.remaining--;
          if (em.remaining <= 3 && em.remaining > 0) playBeep(750, 0.1);
          if (em.remaining <= 0) {
            playBeep(1100, 0.4);
            em.curRound++;
            if (em.curRound > em.totalRounds) {
              playBeep(1500, 0.6);
              this.resetEMOM();
              return;
            }
            em.remaining = em.intervalSecs;
          }
          renderTimerUI();
        }, 1000);
      } else {
        clearInterval(em.timerId);
        renderTimerUI();
      }
    },
    resetEMOM() {
      const em = state.emom;
      clearInterval(em.timerId);
      em.running = false;
      em.curRound = 1;
      em.remaining = em.intervalSecs;
      renderTimerUI();
    }
  };

  window.initTimerUI = function () {
    renderTimerUI();
  };
})();