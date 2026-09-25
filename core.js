// =====================================================================
// core.js — Apex Fitness: shared app shell
// Owns: tab switching, toast notifications, tempo formatting, PWA install.
// Do NOT put Lifting Log / Plate Loader / Macro Tracker feature logic here.
// This file is loaded FIRST (see index.html) and must not read the
// feature-specific state (exercises, availablePlates, foodLogs, etc.)
// directly — call the other modules' exported functions instead.
// =====================================================================

// --- PWA Install Support ---------------------------------------------
// Android/Chrome fires 'beforeinstallprompt' when the manifest + service
// worker pass its installability checks; we capture that event so we can
// trigger the native install dialog from our own "Install App" button
// instead of relying purely on the browser's automatic mini-infobar.
// iOS Safari has no such API at all, so instead we detect iOS and show
// manual "Add to Home Screen" instructions.
let deferredInstallPrompt = null;

    function isRunningStandalone() {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function initPwaInstallUI() {
      const container = document.getElementById('pwaInstallContainer');
      const btn = document.getElementById('pwaInstallBtn');
      const iosHint = document.getElementById('pwaIosHint');
      if (!container) return;

      // Already installed / already running as an installed app: nothing to show.
      if (isRunningStandalone()) {
        container.classList.add('hidden');
        return;
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        container.classList.remove('hidden');
        if (btn) btn.classList.remove('hidden');
        if (iosHint) iosHint.classList.add('hidden');
      });

      window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        container.classList.add('hidden');
        showToast('Apex Fitness installed!');
      });

      const ua = window.navigator.userAgent || '';
      const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
      if (isIOS) {
        container.classList.remove('hidden');
        if (btn) btn.classList.add('hidden');
        if (iosHint) iosHint.classList.remove('hidden');
      }
    }

    async function triggerPwaInstall() {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } finally {
        deferredInstallPrompt = null;
        document.getElementById('pwaInstallBtn')?.classList.add('hidden');
        document.getElementById('pwaInstallContainer')?.classList.add('hidden');
      }
    }

    function formatTempo(input) {
      if (!input || typeof input !== 'string') return '2-0-1-0';
      let str = input.trim().toUpperCase();
      if (!str) return '2-0-1-0';
      str = str.replace(/[\s,]+/g, '-');
      if (/^[0-9X]{4}$/.test(str)) {
        str = str.split('').join('-');
      }
      str = str.replace(/-+/g, '-');
      return str;
    }

    function showToast(msg) {
      const toast = document.getElementById('toastMessage');
      if (toast) {
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
      }
    }

    function switchTab(tab) {
      const logTab = document.getElementById('logTab');
      const platesTab = document.getElementById('platesTab');
      const macrosTab = document.getElementById('macrosTab');
      const tabBtnLog = document.getElementById('tabBtnLog');
      const tabBtnPlates = document.getElementById('tabBtnPlates');
      const tabBtnMacros = document.getElementById('tabBtnMacros');

      logTab?.classList.add('hidden');
      platesTab?.classList.add('hidden');
      macrosTab?.classList.add('hidden');

      if (tabBtnLog) tabBtnLog.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-300 hover:text-white";
      if (tabBtnPlates) tabBtnPlates.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-300 hover:text-white";
      if (tabBtnMacros) tabBtnMacros.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-300 hover:text-white";

      if (tab === 'log') {
        logTab?.classList.remove('hidden');
        if (tabBtnLog) tabBtnLog.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
      } else if (tab === 'plates') {
        platesTab?.classList.remove('hidden');
        if (tabBtnPlates) tabBtnPlates.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
        updateUI();
      } else if (tab === 'macros') {
        macrosTab?.classList.remove('hidden');
        if (tabBtnMacros) tabBtnMacros.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
        renderDay();
      }
    }

    function parseTempoDuration(tempoStr) {
      const formatted = formatTempo(tempoStr);
      const parts = formatted.split('-');
      if (parts.length !== 4) return 3.0;
      let total = 0;
      for (let p of parts) {
        const val = p.trim().toUpperCase();
        if (val === 'X') {
          total += 0.5;
        } else {
          const num = parseFloat(val);
          if (isNaN(num)) return 3.0;
          total += num;
        }
      }
      return total;
    }


// --- Exports (referenced by onclick/onchange attributes in index.html,
//     or called from other module files) ---
window.isRunningStandalone = isRunningStandalone;
window.initPwaInstallUI = initPwaInstallUI;
window.triggerPwaInstall = triggerPwaInstall;
window.formatTempo = formatTempo;
window.showToast = showToast;
window.switchTab = switchTab;

// --- App bootstrap -----------------------------------------------------
// Runs after ALL module scripts have loaded (script tag order in
// index.html), so it's safe to call into lifting-log.js, plate-loader.js
// and macro-tracker.js's exported functions here.
window.onload = function() {
  renderExercises();
  render1RMCard();
  updateSuggestionsSelect();
  calculateFromTarget();
  loadSettings();
  renderDay();
  initPwaInstallUI();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service worker registration failed (app will still work, just without install/offline support):', err);
    });
  }

  document.addEventListener('click', function(e) {
    const sugg = document.getElementById('exerciseSuggestions');
    const input = document.getElementById('exerciseName');
    if (sugg && !sugg.contains(e.target) && e.target !== input) {
      sugg.classList.add('hidden');
    }
  });
};
