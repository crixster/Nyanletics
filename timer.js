// =====================================================================
// timer.js — Nyanletics: Timer Suite
// Owns: Stopwatch (rolling 40 splits), Countdown, and Fully Customizable
//       Simple & Multi-Block Interval Timers with Web Audio & Reordering.
// =====================================================================
(function () {
  'use strict';

  let mode = 'interval'; // 'interval', 'countdown', 'stopwatch'
  let audioCtx = null;
  let isMuted = false;

  // Global Timer State
  const state = {
    stopwatch: {
      running: false,
      startTime: 0,
      elapsed: 0,
      splits: [],
      totalSplitCount: 0,
      timerId: null
    },
    countdown: {
      running: false,
      totalSecs: 180,
      remaining: 180,
      timerId: null
    },
    interval: {
      running: false,
      mode: 'simple', // 'simple' or 'complex'
      // Simple Mode Settings
      simpleWorkSecs: 240,
      simpleRestSecs: 60,
      simpleRounds: 5,
      // Multi-Block Mode Settings
      totalRounds: 3,
      roundRestSecs: 120, // Rest between rounds
      // Customizable steps within 1 Block (Up to 40 Steps total, Work or Rest)
      blockSteps: [
        { id: 'step-1', label: 'Work', type: 'work', secs: 240 },
        { id: 'step-2', label: 'Rest', type: 'rest', secs: 60 }
      ],
      // Execution Queue State
      steps: [],
      stepIdx: 0,
      remaining: 0,
      timerId: null
    }
  };

  const $ = id => document.getElementById(id);

    // ---------- Landscape mode: native lock, else CSS "fake rotate" ----------
  let nativeLandscape = false;
  const isLandscapeMode = () =>
    nativeLandscape || document.body.classList.contains('timer-forced');

  async function enterLandscape() {
    const so = screen.orientation;
    if (so && typeof so.lock === 'function') {
      try {
        await so.lock('landscape');
        nativeLandscape = true;
      } catch (e) {
        try {
          await document.documentElement.requestFullscreen();
          await so.lock('landscape');
          nativeLandscape = true;
        } catch (e2) {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        }
      }
    }
    // Native lock refused (or unsupported, e.g. iOS): rotate with CSS instead.
    if (!nativeLandscape && window.matchMedia('(orientation: portrait)').matches) {
      document.body.classList.add('timer-forced');
    }
    renderTimerUI();
  }

  function exitLandscape() {
    if (nativeLandscape) {
      try { screen.orientation.unlock(); } catch (e) {}
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      nativeLandscape = false;
    }
    document.body.classList.remove('timer-forced');
    renderTimerUI();
  }

  function toggleLandscape() {
    if (isLandscapeMode()) exitLandscape(); else enterLandscape();
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && nativeLandscape) exitLandscape();
  });

  // Web Audio Synthesizer for Beeps
  function playBeep(freq = 800, duration = 0.12) {
    if (isMuted) return;
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
    return `${m}:${s}<span class="text-xs opacity-70">.${cs}</span>`;
  }

  function fmtSecs(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function toggleMute() {
    isMuted = !isMuted;
    renderTimerUI();
  }

  function setTimerMode(newMode) {
    const isRunning = state.stopwatch.running || state.countdown.running || state.interval.running;
    if (isRunning) return;
    mode = newMode;
    renderTimerUI();
  }

  // Build sequential execution queue for Interval timer
  function buildIntervalSteps() {
    const it = state.interval;
    const steps = [];

    if (it.mode === 'simple') {
      for (let r = 1; r <= it.simpleRounds; r++) {
        if (it.simpleWorkSecs > 0) {
          steps.push({ label: 'WORK', type: 'work', secs: it.simpleWorkSecs, round: r, totalRounds: it.simpleRounds });
        }
        if (it.simpleRestSecs > 0 && r < it.simpleRounds) {
          steps.push({ label: 'REST', type: 'rest', secs: it.simpleRestSecs, round: r, totalRounds: it.simpleRounds });
        }
      }
    } else {
      for (let r = 1; r <= it.totalRounds; r++) {
        it.blockSteps.forEach(bs => {
          if (bs.secs > 0) {
            steps.push({
              label: (bs.label || bs.type).toUpperCase(),
              type: bs.type,
              secs: bs.secs,
              round: r,
              totalRounds: it.totalRounds
            });
          }
        });

        if (r < it.totalRounds && it.roundRestSecs > 0) {
          steps.push({
            label: 'ROUND REST',
            type: 'round_rest',
            secs: it.roundRestSecs,
            round: r,
            totalRounds: it.totalRounds
          });
        }
      }
    }
    return steps;
  }

  function renderTimerUI() {
    const root = $('timerTab');
    if (!root) return;

    const isRunning = (mode === 'stopwatch' && state.stopwatch.running) ||
                      (mode === 'countdown' && state.countdown.running) ||
                      (mode === 'interval' && state.interval.running);

    const navClass = m => m === mode
      ? 'flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-md transition-all'
      : 'flex-1 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white transition-all';

    root.innerHTML = `
      <div class="glass-card rounded-2xl p-4 shadow-xl border ${isRunning ? 'border-emerald-500/60 ring-4 ring-emerald-500/30 shadow-emerald-500/20 bg-slate-950/95' : 'border-indigo-500/20'} space-y-4 transition-all duration-300">
        <!-- Top Bar: Mode Selector & Mute Toggle -->
        <div class="flex items-center justify-between gap-2">
          ${!isRunning ? `
            <div class="flex-1 flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-center gap-1">
              <button onclick="window.nyanTimer.setMode('interval')" class="${navClass('interval')}">Interval</button>
              <button onclick="window.nyanTimer.setMode('countdown')" class="${navClass('countdown')}">Countdown</button>
              <button onclick="window.nyanTimer.setMode('stopwatch')" class="${navClass('stopwatch')}">Stopwatch</button>
            </div>
          ` : `
            <div class="flex-1 flex items-center px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-400 gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>TIMER ACTIVE — Controls Locked until Reset</span>
            </div>
          `}

          <div class="flex flex-col gap-1.5 flex-shrink-0">
            <button onclick="window.nyanTimer.toggleMute()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5" title="Toggle Sound Cues">
              <i class="fa-solid ${isMuted ? 'fa-volume-xmark text-rose-400' : 'fa-volume-high text-emerald-400'}"></i>
              <span class="hidden sm:inline">${isMuted ? 'Muted' : 'Sound On'}</span>
            </button>

            <button onclick="window.nyanTimer.toggleLandscape()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5" title="Rotate timer to landscape">
              <i class="fa-solid ${isLandscapeMode() ? 'fa-compress text-amber-400' : 'fa-rotate text-indigo-400'}"></i>
              <span>${isLandscapeMode() ? 'Exit' : 'Rotate'}</span>
            </button>
          </div>
        </div>

        <div id="timerDisplayArea">
          ${renderModeContent(isRunning)}
        </div>
      </div>
    `;
  }

  function renderModeContent(isRunning) {
    if (mode === 'stopwatch') return renderStopwatch(isRunning);
    if (mode === 'countdown') return renderCountdown(isRunning);
    if (mode === 'interval') return renderInterval(isRunning);
    return '';
  }

  // ---------- 1. Stopwatch & Split Timer (Rolling 40 Splits) ----------
  function renderStopwatch(isRunning) {
    const sw = state.stopwatch;

    return `
      <div class="text-center space-y-5">
        <div class="flex items-center justify-center gap-4 my-2">
          <div id="stopwatchDisplay" class="${isRunning ? 'text-7xl sm:text-8xl py-4' : 'text-6xl my-2'} font-black font-mono text-indigo-400 tracking-wider drop-shadow-lg transition-all">
            ${fmtTime(sw.elapsed)}
          </div>
          ${sw.running ? `
            <button onclick="window.nyanTimer.splitStopwatch()" class="px-5 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg transition flex flex-col items-center justify-center gap-1 flex-shrink-0 animate-pulse" title="Record Split">
              <i class="fa-solid fa-stopwatch text-base"></i>
              <span class="text-[10px]">Split #${sw.totalSplitCount + 1}</span>
            </button>
          ` : ''}
        </div>

        <div class="flex gap-2 justify-center">
          <button onclick="window.nyanTimer.toggleStopwatch()" class="px-7 py-3 rounded-xl text-xs font-bold ${sw.running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-md transition">
            ${sw.running ? 'Pause' : 'Start'}
          </button>
          ${!sw.running ? `
            <button onclick="window.nyanTimer.splitStopwatch()" class="px-6 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition opacity-50 cursor-not-allowed" title="Start stopwatch to record splits">
              Split
            </button>
          ` : ''}
          <button onclick="window.nyanTimer.confirmReset('stopwatch')" class="px-6 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Reset
          </button>
        </div>
        
        <div id="stopwatchSplitsContainer">
          ${sw.splits.length ? `
            <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-800 max-h-56 overflow-y-auto text-xs space-y-1.5">
              <div class="text-[11px] text-slate-400 font-bold flex justify-between border-b border-slate-800 pb-1">
                <span>Split #</span>
                <span>Split Time</span>
                <span>Total Time</span>
              </div>
              ${sw.splits.map((s) => `
                <div class="flex justify-between text-slate-300 border-b border-slate-800/40 pb-1 font-mono">
                  <span class="font-bold text-indigo-400">#${s.num}</span>
                  <span class="text-emerald-400 font-semibold">${fmtTime(s.diff)}</span>
                  <span class="text-slate-400">${fmtTime(s.total)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ---------- 2. Countdown Timer ----------
  function renderCountdown(isRunning) {
    const cd = state.countdown;
    const m = Math.floor(cd.totalSecs / 60);
    const s = cd.totalSecs % 60;

    return `
      <div class="text-center space-y-4">
        <div id="countdownDisplay" class="${isRunning ? 'text-7xl sm:text-8xl py-6' : 'text-6xl my-4'} font-black font-mono text-emerald-400 tracking-wider drop-shadow-lg transition-all">
          ${fmtSecs(cd.remaining)}
        </div>
        
        ${!isRunning ? `
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
        ` : ''}

        <div class="flex gap-2 justify-center pt-2">
          <button onclick="window.nyanTimer.toggleCountdown()" class="px-8 py-3 rounded-xl text-xs font-bold ${cd.running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-md transition">
            ${cd.running ? 'Pause' : 'Start'}
          </button>
          <button onclick="window.nyanTimer.confirmReset('countdown')" class="px-6 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Reset
          </button>
        </div>
      </div>
    `;
  }

  // ---------- 3. Interval Timer (Simple & Multi-Block) ----------
  function renderInterval(isRunning) {
    const it = state.interval;

    if (!it.steps.length) {
      it.steps = buildIntervalSteps();
      it.remaining = it.steps[0] ? it.steps[0].secs : 0;
    }

    const curStep = it.steps[it.stepIdx] || it.steps[0] || { label: 'WORK', type: 'work', round: 1, totalRounds: 1 };
    const nextStep = it.steps[it.stepIdx + 1];

    const sWM = Math.floor(it.simpleWorkSecs / 60), sWS = it.simpleWorkSecs % 60;
    const sRM = Math.floor(it.simpleRestSecs / 60), sRS = it.simpleRestSecs % 60;
    const rRM = Math.floor(it.roundRestSecs / 60), rRS = it.roundRestSecs % 60;

    const totalStepsCount = it.blockSteps.length;

    const badgeStyle = {
      work: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      rest: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      round_rest: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    }[curStep.type] || 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

    return `
      <div class="space-y-4 text-center">
        <!-- Mode Selector (Hidden when running) -->
        ${!isRunning ? `
          <div class="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-center gap-1 max-w-xs mx-auto">
            <button onclick="window.nyanTimer.setIntervalMode('simple')" class="flex-1 py-1.5 text-[11px] font-bold rounded-lg ${it.mode === 'simple' ? 'bg-indigo-600 text-white' : 'text-slate-400'} transition">Simple Interval</button>
            <button onclick="window.nyanTimer.setIntervalMode('complex')" class="flex-1 py-1.5 text-[11px] font-bold rounded-lg ${it.mode === 'complex' ? 'bg-indigo-600 text-white' : 'text-slate-400'} transition">Multi-Block Interval</button>
          </div>

          ${it.mode === 'simple' ? `
            <div class="grid grid-cols-3 gap-2.5 text-xs text-left max-w-md mx-auto bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div>
                <label class="text-[11px] text-emerald-400 font-bold block mb-1">Work (Min : Sec)</label>
                <div class="flex items-center gap-1">
                  <input type="number" min="0" value="${sWM}" onchange="window.nyanTimer.updateSimpleCfg('workMin', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
                  <span class="text-slate-500 font-bold">:</span>
                  <input type="number" min="0" max="59" value="${sWS}" onchange="window.nyanTimer.updateSimpleCfg('workSec', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
                </div>
              </div>

              <div>
                <label class="text-[11px] text-amber-400 font-bold block mb-1">Rest (Min : Sec)</label>
                <div class="flex items-center gap-1">
                  <input type="number" min="0" value="${sRM}" onchange="window.nyanTimer.updateSimpleCfg('restMin', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
                  <span class="text-slate-500 font-bold">:</span>
                  <input type="number" min="0" max="59" value="${sRS}" onchange="window.nyanTimer.updateSimpleCfg('restSec', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
                </div>
              </div>

              <div>
                <label class="text-[11px] text-indigo-400 font-bold block mb-1">Intervals</label>
                <input type="number" min="1" value="${it.simpleRounds}" onchange="window.nyanTimer.updateSimpleCfg('rounds', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium mt-0.5">
              </div>
            </div>
          ` : `
            <div class="space-y-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs text-left max-w-md mx-auto">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[10px] text-indigo-400 font-bold block mb-1">Total Rounds</label>
                  <input type="number" min="1" value="${it.totalRounds}" onchange="window.nyanTimer.updateComplexMeta('totalRounds', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
                </div>
                <div>
                  <label class="text-[10px] text-indigo-300 font-bold block mb-1">Round Rest Time (M:S)</label>
                  <div class="flex items-center gap-1">
                    <input type="number" min="0" value="${rRM}" onchange="window.nyanTimer.updateComplexMeta('roundRestMin', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
                    <span class="text-slate-500 font-bold">:</span>
                    <input type="number" min="0" max="59" value="${rRS}" onchange="window.nyanTimer.updateComplexMeta('roundRestSec', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-medium">
                  </div>
                </div>
              </div>

              <!-- Block Sequence Pattern Customizer (Unified Up to 40 Steps, ~10 Visible before scroll) -->
              <div class="border-t border-slate-800 pt-2 space-y-2">
                <div class="flex justify-between items-center">
                  <span class="text-[11px] font-bold text-slate-300">Block Pattern Steps (${totalStepsCount}/40)</span>
                  <button onclick="window.nyanTimer.addBlockStep()" ${totalStepsCount >= 40 ? 'disabled' : ''} class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-30">
                    + Add Step
                  </button>
                </div>

                <div class="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  ${it.blockSteps.map((s, idx) => {
                    const sm = Math.floor(s.secs / 60), ss = s.secs % 60;
                    const isWork = s.type === 'work';
                    return `
                      <div class="flex items-center justify-between gap-1.5 bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                        <div class="flex flex-col gap-0.5">
                          <button onclick="window.nyanTimer.moveBlockStep(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="text-slate-400 hover:text-white disabled:opacity-20 text-[10px] px-1" title="Move Up">▲</button>
                          <button onclick="window.nyanTimer.moveBlockStep(${idx}, 1)" ${idx === it.blockSteps.length - 1 ? 'disabled' : ''} class="text-slate-400 hover:text-white disabled:opacity-20 text-[10px] px-1" title="Move Down">▼</button>
                        </div>

                        <!-- Work / Rest Selector Dropdown -->
                        <select onchange="window.nyanTimer.updateStepType(${idx}, this.value)" class="text-[10px] font-extrabold uppercase px-2 py-1 rounded bg-slate-900 border border-slate-700 ${isWork ? 'text-emerald-400' : 'text-amber-400'} flex-shrink-0 cursor-pointer">
                          <option value="work" ${isWork ? 'selected' : ''}>Work</option>
                          <option value="rest" ${!isWork ? 'selected' : ''}>Rest</option>
                        </select>
                        
                        <input type="text" value="${s.label}" placeholder="Description" onchange="window.nyanTimer.updateStepLabel(${idx}, this.value)" class="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-medium">

                        <div class="flex items-center gap-1 text-[11px]">
                          <input type="number" min="0" value="${sm}" onchange="window.nyanTimer.updateStepSecs(${idx}, 'min', this.value)" class="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white font-medium" title="Minutes">
                          <span class="text-slate-500 font-bold">:</span>
                          <input type="number" min="0" max="59" value="${ss}" onchange="window.nyanTimer.updateStepSecs(${idx}, 'sec', this.value)" class="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white font-medium" title="Seconds">
                        </div>

                        <button onclick="window.nyanTimer.removeBlockStep(${idx})" ${it.blockSteps.length <= 1 ? 'disabled' : ''} class="text-slate-500 hover:text-rose-400 p-1 disabled:opacity-20 transition" title="Delete Step">
                          <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `}` : ''}

        <!-- Active Timer Display with Side Skip Button when Running -->
        <div class="py-1">
          <span class="inline-block px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border ${badgeStyle}">
            ${curStep.label} — Round ${curStep.round}/${curStep.totalRounds}
          </span>
          
          <div class="flex items-center justify-center gap-4 my-2">
            <div class="${isRunning ? 'text-7xl sm:text-8xl py-4' : 'text-6xl my-2'} font-black font-mono text-indigo-400 drop-shadow-lg transition-all">
              ${fmtSecs(it.remaining)}
            </div>
            ${it.running ? `
              <button onclick="window.nyanTimer.skipInterval()" class="px-5 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg transition flex flex-col items-center justify-center gap-1 flex-shrink-0 animate-pulse" title="Skip to Next Interval">
                <i class="fa-solid fa-forward-step text-base"></i>
                <span class="text-[10px]">Skip</span>
              </button>
            ` : ''}
          </div>

          ${nextStep ? `
            <div class="text-[11px] text-slate-400 font-medium">
              Next: <span class="text-slate-200 font-bold">${nextStep.label}</span> (${fmtSecs(nextStep.secs)})
            </div>
          ` : `
            <div class="text-[11px] text-emerald-400 font-bold">Final Interval Step!</div>
          `}
        </div>

        <div class="flex gap-2 justify-center">
          <button onclick="window.nyanTimer.toggleInterval()" class="px-8 py-3 rounded-xl text-xs font-bold ${it.running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-md transition">
            ${it.running ? 'Pause' : 'Start Interval'}
          </button>
          <button onclick="window.nyanTimer.confirmReset('interval')" class="px-6 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Reset
          </button>
        </div>
      </div>
    `;
  }

  // Global Engine Public API
  window.nyanTimer = {
    setMode: setTimerMode,
    toggleMute: toggleMute,
    toggleLandscape: toggleLandscape,

    confirmReset(type) {
      if (confirm('Are you sure you want to reset the timer?')) {
        if (type === 'stopwatch') this.resetStopwatch();
        if (type === 'countdown') this.resetCountdown();
        if (type === 'interval') this.resetInterval();
      }
    },

    // ---------- Stopwatch (Rolling Buffer up to 40) ----------
    toggleStopwatch() {
      const sw = state.stopwatch;
      sw.running = !sw.running;
      if (sw.running) {
        sw.startTime = Date.now() - sw.elapsed;
        sw.timerId = setInterval(() => {
          sw.elapsed = Date.now() - sw.startTime;
          const disp = $('stopwatchDisplay');
          if (disp) disp.innerHTML = fmtTime(sw.elapsed);
        }, 30);
      } else {
        clearInterval(sw.timerId);
      }
      renderTimerUI();
    },
    splitStopwatch() {
      const sw = state.stopwatch;
      if (!sw.running) return;
      sw.totalSplitCount++;
      const prevTotal = sw.splits.length ? sw.splits[0].total : 0;
      const newSplit = {
        num: sw.totalSplitCount,
        total: sw.elapsed,
        diff: sw.elapsed - prevTotal
      };
      sw.splits.unshift(newSplit);
      if (sw.splits.length > 40) {
        sw.splits.pop(); // Keep max 40 active splits in view, rolling over
      }
      renderTimerUI();
    },
    resetStopwatch() {
      const sw = state.stopwatch;
      clearInterval(sw.timerId);
      sw.running = false;
      sw.elapsed = 0;
      sw.splits = [];
      sw.totalSplitCount = 0;
      renderTimerUI();
    },

    // ---------- Countdown ----------
    setCDPreset(secs) {
      this.resetCountdown();
      state.countdown.totalSecs = secs;
      state.countdown.remaining = secs;
      renderTimerUI();
    },
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
          if (cd.remaining <= 10 && cd.remaining > 0) {
            playBeep(cd.remaining <= 3 ? 900 : 750, 0.1);
          }
          if (cd.remaining <= 0) {
            playBeep(1300, 0.5);
            this.resetCountdown();
          } else {
            renderTimerUI();
          }
        }, 1000);
      } else {
        clearInterval(cd.timerId);
      }
      renderTimerUI();
    },
    resetCountdown() {
      const cd = state.countdown;
      clearInterval(cd.timerId);
      cd.running = false;
      cd.remaining = cd.totalSecs;
      renderTimerUI();
    },

    // ---------- Interval Timer ----------
    setIntervalMode(m) {
      state.interval.mode = m;
      this.resetInterval();
    },
    updateSimpleCfg(field, val) {
      const it = state.interval;
      let wM = Math.floor(it.simpleWorkSecs / 60), wS = it.simpleWorkSecs % 60;
      let rM = Math.floor(it.simpleRestSecs / 60), rS = it.simpleRestSecs % 60;
      const n = Math.max(0, parseInt(val) || 0);

      if (field === 'workMin') wM = n;
      if (field === 'workSec') wS = Math.min(59, n);
      if (field === 'restMin') rM = n;
      if (field === 'restSec') rS = Math.min(59, n);
      if (field === 'rounds') it.simpleRounds = Math.max(1, n);

      it.simpleWorkSecs = wM * 60 + wS;
      it.simpleRestSecs = rM * 60 + rS;

      this.resetInterval();
    },
    updateComplexMeta(field, val) {
      const it = state.interval;
      const n = Math.max(0, parseInt(val) || 0);
      let rRM = Math.floor(it.roundRestSecs / 60), rRS = it.roundRestSecs % 60;

      if (field === 'totalRounds') it.totalRounds = Math.max(1, n);
      if (field === 'roundRestMin') rRM = n;
      if (field === 'roundRestSec') rRS = Math.min(59, n);

      it.roundRestSecs = rRM * 60 + rRS;
      this.resetInterval();
    },
    addBlockStep() {
      const it = state.interval;
      if (it.blockSteps.length >= 40) return;

      it.blockSteps.push({
        id: 'step-' + Date.now() + Math.random().toString(36).slice(2, 5),
        label: 'Work',
        type: 'work',
        secs: 180
      });

      this.resetInterval();
    },
    removeBlockStep(idx) {
      const it = state.interval;
      if (it.blockSteps.length <= 1) return;
      it.blockSteps.splice(idx, 1);
      this.resetInterval();
    },
    moveBlockStep(idx, direction) {
      const steps = state.interval.blockSteps;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= steps.length) return;
      const temp = steps[idx];
      steps[idx] = steps[targetIdx];
      steps[targetIdx] = temp;
      this.resetInterval();
    },
    updateStepType(idx, val) {
      const step = state.interval.blockSteps[idx];
      if (step) {
        step.type = val;
        if (step.label === 'Work' || step.label === 'Rest') {
          step.label = val === 'work' ? 'Work' : 'Rest';
        }
        this.resetInterval();
      }
    },
    updateStepLabel(idx, val) {
      const step = state.interval.blockSteps[idx];
      if (step) step.label = val.trim() || (step.type === 'work' ? 'Work' : 'Rest');
    },
    updateStepSecs(idx, unit, val) {
      const step = state.interval.blockSteps[idx];
      if (!step) return;
      let m = Math.floor(step.secs / 60);
      let s = step.secs % 60;
      const n = Math.max(0, parseInt(val) || 0);

      if (unit === 'min') m = n;
      if (unit === 'sec') s = Math.min(59, n);

      step.secs = m * 60 + s;
      this.resetInterval();
    },
    skipInterval() {
      const it = state.interval;
      if (!it.steps.length) return;
      it.stepIdx++;
      if (it.stepIdx >= it.steps.length) {
        playBeep(1500, 0.5);
        this.resetInterval();
        return;
      }
      it.remaining = it.steps[it.stepIdx].secs;
      playBeep(900, 0.15);
      renderTimerUI();
    },
    toggleInterval() {
      const it = state.interval;
      it.running = !it.running;

      if (it.running) {
        if (!it.steps.length) it.steps = buildIntervalSteps();

        it.timerId = setInterval(() => {
          it.remaining--;

          if (it.remaining <= 10 && it.remaining > 0) {
            playBeep(it.remaining <= 3 ? 900 : 750, 0.1);
          }

          if (it.remaining <= 0) {
            playBeep(1200, 0.35);
            it.stepIdx++;

            if (it.stepIdx >= it.steps.length) {
              playBeep(1500, 0.6);
              this.resetInterval();
              return;
            }

            it.remaining = it.steps[it.stepIdx].secs;
          }
          renderTimerUI();
        }, 1000);
      } else {
        clearInterval(it.timerId);
      }
      renderTimerUI();
    },
    resetInterval() {
      const it = state.interval;
      clearInterval(it.timerId);
      it.running = false;
      it.stepIdx = 0;
      it.steps = buildIntervalSteps();
      it.remaining = it.steps[0] ? it.steps[0].secs : 0;
      renderTimerUI();
    }
  };

  window.initTimerUI = function () {
    renderTimerUI();
  };
})();
