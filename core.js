// =====================================================================
// core.js — Apex Fitness: shared app shell
// Owns: tab switching, toast notifications, tempo formatting, PWA install.
// =====================================================================

let deferredInstallPrompt = null;

function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function initPwaInstallUI() {
  const container = document.getElementById('pwaInstallContainer');
  const btn = document.getElementById('pwaInstallBtn');
  const iosHint = document.getElementById('pwaIosHint');
  if (!container) return;

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
    showToast('Nyanletics Hybrid Training installed!');
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
  const tabName = (tab === 'plate') ? 'plates' : tab;

  const logTab = document.getElementById('logTab');
  const platesTab = document.getElementById('platesTab');
  const macrosTab = document.getElementById('macrosTab');
  const rehabTab = document.getElementById('rehabTab');

  const tabBtnLog = document.getElementById('tabBtnLog') || document.getElementById('nav-log');
  const tabBtnPlates = document.getElementById('tabBtnPlates') || document.getElementById('nav-plate') || document.getElementById('nav-plates');
  const tabBtnMacros = document.getElementById('tabBtnMacros') || document.getElementById('nav-macro') || document.getElementById('nav-macros');
  const tabBtnRehab = document.getElementById('tabBtnRehab') || document.getElementById('nav-rehab');

  logTab?.classList.add('hidden');
  platesTab?.classList.add('hidden');
  macrosTab?.classList.add('hidden');
  rehabTab?.classList.add('hidden');

  const inactiveClass = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-300 hover:text-white flex-shrink-0 flex items-center justify-center gap-2 px-4";
  const activeClass = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 flex-shrink-0 flex items-center justify-center gap-2 px-4";

  if (tabBtnLog) tabBtnLog.className = inactiveClass;
  if (tabBtnPlates) tabBtnPlates.className = inactiveClass;
  if (tabBtnMacros) tabBtnMacros.className = inactiveClass;
  if (tabBtnRehab) tabBtnRehab.className = inactiveClass;

  if (tabName === 'log') {
    logTab?.classList.remove('hidden');
    if (tabBtnLog) tabBtnLog.className = activeClass;
    if (typeof renderExercises === 'function') renderExercises();
    if (typeof render1RMCard === 'function') render1RMCard();
    if (typeof updateSuggestionsSelect === 'function') updateSuggestionsSelect();
  } else if (tabName === 'plates') {
    platesTab?.classList.remove('hidden');
    if (tabBtnPlates) tabBtnPlates.className = activeClass;
    if (typeof updateUI === 'function') updateUI();
  } else if (tabName === 'macros') {
    macrosTab?.classList.remove('hidden');
    if (tabBtnMacros) tabBtnMacros.className = activeClass;
    if (typeof renderDay === 'function') renderDay();
  } else if (tabName === 'rehab') {
    rehabTab?.classList.remove('hidden');
    if (tabBtnRehab) tabBtnRehab.className = activeClass;
    if (typeof renderCharacterView === 'function') renderCharacterView();
    if (typeof renderLegend === 'function') renderLegend();
    if (typeof renderPicker === 'function') renderPicker();
    if (typeof renderWorkout === 'function') renderWorkout();
    if (typeof renderSchedule === 'function') renderSchedule();
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

// Global Exports
window.isRunningStandalone = isRunningStandalone;
window.initPwaInstallUI = initPwaInstallUI;
window.triggerPwaInstall = triggerPwaInstall;
window.formatTempo = formatTempo;
window.showToast = showToast;
window.switchTab = switchTab;

// App Bootstrap
window.onload = function() {
  if (typeof renderExercises === 'function') renderExercises();
  if (typeof render1RMCard === 'function') render1RMCard();
  if (typeof updateSuggestionsSelect === 'function') updateSuggestionsSelect();
  if (typeof calculateFromTarget === 'function') calculateFromTarget();
  if (typeof loadSettings === 'function') loadSettings();
  if (typeof renderDay === 'function') renderDay();
  if (typeof initRehabUI === 'function') initRehabUI();
  
  initPwaInstallUI();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
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