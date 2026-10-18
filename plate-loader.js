// =====================================================================
// plate-loader.js — Apex Fitness: Plate Loader tab
// Owns: plateDefinitions, availablePlates inventory, loadedPlatesPerSide,
// selectedBarWeightKg, the barbell + sled SVG visualizers and inventory grid.
// The visualizer swaps between two views (plateViewMode): 'barbell' loads
// plates in pairs, 'sled' stacks single plates on the loading pin (50 kg
// empty) and offers HYROX push/pull quick-load buttons.
// calculateFromTarget() is called from core.js's bootstrap and from
// lifting-log.js's loadSuggestedWeightToPlateCalculator — keep its
// signature stable if you touch it.
// NOTE: this state is NOT currently persisted to localStorage — it
// resets to defaultInventory on every page reload. Worth fixing
// alongside the split (see chat).
// =====================================================================

const plateDefinitions = [
  { id: 'red25kg', name: 'Olympic Red', weight: 25, unit: 'kg', color: '#ef4444', height: 110, width: 18 },
  { id: 'blue20kg', name: 'Olympic Blue', weight: 20, unit: 'kg', color: '#3b82f6', height: 105, width: 17 },
  { id: 'yellow15kg', name: 'Olympic Yellow', weight: 15, unit: 'kg', color: '#eab308', height: 95, width: 16 },
  { id: 'green10kg', name: 'Olympic Green', weight: 10, unit: 'kg', color: '#22c55e', height: 85, width: 14 },
  { id: 'white5kg', name: 'Olympic White', weight: 5, unit: 'kg', color: '#f8fafc', textColor: '#0f172a', height: 70, width: 13 },
  { id: 'orange2d5kg', name: 'Change Orange', weight: 2.5, unit: 'kg', color: '#f97316', height: 58, width: 12 },
  { id: 'yellow1d5kg', name: 'Change Yellow', weight: 1.5, unit: 'kg', color: '#fde047', textColor: '#0f172a', height: 50, width: 11 },
  { id: 'green1kg', name: 'Change Green', weight: 1, unit: 'kg', color: '#15803d', height: 44, width: 10 },
  { id: 'white0d5kg', name: 'Change White', weight: 0.5, unit: 'kg', color: '#f8fafc', textColor: '#0f172a', height: 38, width: 9 },
  { id: 'black45lb', name: 'Bumper 45lb', weight: 45, unit: 'lb', color: '#334155', height: 110, width: 18 },
  { id: 'black35lb', name: 'Bumper 35lb', weight: 35, unit: 'lb', color: '#475569', height: 100, width: 17 },
  { id: 'black25lb', name: 'Bumper 25lb', weight: 25, unit: 'lb', color: '#64748b', height: 90, width: 15 },
  { id: 'grey10lb', name: 'Iron 10lb', weight: 10, unit: 'lb', color: '#94a3b8', textColor: '#0f172a', height: 75, width: 13 },
  { id: 'grey5lb', name: 'Iron 5lb', weight: 5, unit: 'lb', color: '#cbd5e1', textColor: '#0f172a', height: 62, width: 11 }
];

const factoryInventory = {
  red25kg: 16, blue20kg: 16, yellow15kg: 16, green10kg: 16, white5kg: 8,
  orange2d5kg: 4, yellow1d5kg: 4, green1kg: 4, white0d5kg: 4,
  black45lb: 16, black35lb: 16, black25lb: 16, grey10lb: 16, grey5lb: 8
};

const PLATE_DEFAULTS_KEY = 'apex_plate_defaults';

function loadPlateDefaults() {
  const inv = { ...factoryInventory };
  try {
    const saved = JSON.parse(localStorage.getItem(PLATE_DEFAULTS_KEY) || '{}');
    Object.keys(saved).forEach(id => {
      const n = parseInt(saved[id], 10);
      if (id in inv && Number.isFinite(n) && n >= 0) inv[id] = Math.min(n, 99);
    });
  } catch (e) {}
  return inv;
}

let defaultInventory = loadPlateDefaults();
let availablePlates = { ...defaultInventory };
let loadedPlatesPerSide = [];
let selectedBarWeightKg = 20;

// ---- Sled view ----------------------------------------------------------
// Both views share one plate inventory. Leaving a view returns its plates to
// stock, and each view remembers its own target weight (modeTargets).
const SLED_DEFAULT_WEIGHT_KG = 50;          // empty sled
let plateViewMode = 'barbell';              // 'barbell' | 'sled'
let loadedSledPlates = [];                  // single plates, index 0 = bottom of stack
let sledBaseWeightKg = SLED_DEFAULT_WEIGHT_KG;
const modeTargets = { barbell: null, sled: null };   // last { value, unit } per view

// HYROX totals INCLUDE the 50 kg sled.
const HYROX_SLED_PRESETS = [
  { title: 'Sled Push', options: [
    { label: 'Women Open', kg: 102 },
    { label: 'Men Open / Women Pro', kg: 152 },
    { label: 'Men Pro', kg: 202 }
  ] },
  { title: 'Sled Pull', options: [
    { label: 'Women Open', kg: 78 },
    { label: 'Men Open / Women Pro', kg: 103 },
    { label: 'Men Pro', kg: 153 }
  ] }
];

    function getPlateWeightInKg(plate) {
      return plate.unit === 'kg' ? plate.weight : plate.weight * 0.45359237;
    }

    function sortLoadedPlates() {
      loadedPlatesPerSide.sort((a, b) => {
        if (a.unit !== b.unit) {
          return a.unit === 'kg' ? -1 : 1;
        }
        return b.weight - a.weight;
      });

      // Sled stack: heaviest plate at the bottom regardless of unit.
      loadedSledPlates.sort((a, b) => {
        const diff = getPlateWeightInKg(b) - getPlateWeightInKg(a);
        if (Math.abs(diff) > 0.0001) return diff;
        return a.unit === b.unit ? 0 : (a.unit === 'kg' ? -1 : 1);
      });
    }

    function calculateTotalWeightKg() {
      if (plateViewMode === 'sled') {
        const sledPlatesKg = loadedSledPlates.reduce((sum, p) => sum + getPlateWeightInKg(p), 0);
        return sledBaseWeightKg + sledPlatesKg;
      }
      const platesSumKg = loadedPlatesPerSide.reduce((sum, p) => {
        return sum + (getPlateWeightInKg(p) * 2);
      }, 0);
      return selectedBarWeightKg + platesSumKg;
    }

    function onBarWeightSelectChange() {
      const barSelect = document.getElementById('barWeight');
      const customContainer = document.getElementById('customBarContainer');
      if (!barSelect) return;
      if (barSelect.value === 'custom') {
        customContainer?.classList.remove('hidden');
        const customVal = parseFloat(document.getElementById('customBarWeight')?.value) || 0;
        selectedBarWeightKg = customVal;
      } else {
        customContainer?.classList.add('hidden');
        selectedBarWeightKg = parseFloat(barSelect.value) || 20;
      }
      calculateFromTarget();
    }

    function onCustomBarInput() {
      const customVal = parseFloat(document.getElementById('customBarWeight')?.value) || 0;
      selectedBarWeightKg = customVal;
      calculateFromTarget();
    }

    function calculateFromTarget() {
      const targetEl = document.getElementById('targetWeight');
      const unitEl = document.getElementById('loaderUnit');
      const targetInput = targetEl ? (parseFloat(targetEl.value) || 0) : 0;
      const unit = unitEl ? unitEl.value : 'kg';
      
      const targetKg = unit === 'kg' ? targetInput : targetInput * 0.45359237;

      if (plateViewMode === 'sled') {
        calculateSledFromTarget(targetKg);
        return;
      }

      let remainingSideKg = Math.max(0, (targetKg - selectedBarWeightKg) / 2);

      loadedPlatesPerSide.forEach(p => {
        availablePlates[p.id] = (availablePlates[p.id] || 0) + 2;
      });

      const sortedAvailable = [...plateDefinitions].sort((a, b) => {
        if (a.unit !== b.unit) {
          return a.unit === 'kg' ? -1 : 1;
        }
        return b.weight - a.weight;
      });

      loadedPlatesPerSide = [];

      for (let plate of sortedAvailable) {
        const pKg = getPlateWeightInKg(plate);
        while (remainingSideKg >= pKg - 0.001 && availablePlates[plate.id] >= 2) {
          loadedPlatesPerSide.push(plate);
          availablePlates[plate.id] -= 2;
          remainingSideKg -= pKg;
        }
      }

      sortLoadedPlates();
      updateUI(false);
    }

    // Sled: one plate at a time (no pairs). Target is the TOTAL including the sled.
    function calculateSledFromTarget(targetKg) {
      let remainingKg = Math.max(0, targetKg - sledBaseWeightKg);

      loadedSledPlates.forEach(p => {
        availablePlates[p.id] = (availablePlates[p.id] || 0) + 1;
      });
      loadedSledPlates = [];

      const sortedAvailable = [...plateDefinitions].sort((a, b) => {
        if (a.unit !== b.unit) {
          return a.unit === 'kg' ? -1 : 1;
        }
        return b.weight - a.weight;
      });

      for (let plate of sortedAvailable) {
        const pKg = getPlateWeightInKg(plate);
        while (remainingKg >= pKg - 0.001 && availablePlates[plate.id] >= 1) {
          loadedSledPlates.push(plate);
          availablePlates[plate.id] -= 1;
          remainingKg -= pKg;
        }
      }

      sortLoadedPlates();
      updateUI(false);
    }

    function syncTargetFromLoaded() {
      sortLoadedPlates();
      const totalKg = calculateTotalWeightKg();
      const unitEl = document.getElementById('loaderUnit');
      const unit = unitEl ? unitEl.value : 'kg';
      const totalDisplay = unit === 'kg' ? totalKg : totalKg * 2.20462;
      
      const targetInput = document.getElementById('targetWeight');
      if (targetInput) {
        targetInput.value = (Math.round(totalDisplay * 10) / 10);
      }
      updateUI(false);
    }

    function onTargetInputChanged() {
      calculateFromTarget();
    }

    function onUnitChanged() {
      syncTargetFromLoaded();
    }

    function clearBarbell() {
      if (plateViewMode === 'sled') {
        loadedSledPlates.forEach(p => {
          availablePlates[p.id] = (availablePlates[p.id] || 0) + 1;
        });
        loadedSledPlates = [];
        syncTargetFromLoaded();
        showToast('Cleared all plates from sled and returned stock');
        return;
      }
      loadedPlatesPerSide.forEach(p => {
        availablePlates[p.id] = (availablePlates[p.id] || 0) + 2;
      });
      loadedPlatesPerSide = [];
      syncTargetFromLoaded();
      showToast('Cleared all plates from barbell and returned stock');
    }

    function incrementInventory(e, plateId) {
      if (e) e.stopPropagation();
      availablePlates[plateId] = (availablePlates[plateId] || 0) + 1;
      updateUI(false);
    }

    function decrementInventory(e, plateId) {
      if (e) e.stopPropagation();
      if (availablePlates[plateId] > 0) {
        availablePlates[plateId]--;
        updateUI(false);
      }
    }

    function setInventoryQty(plateId, val, reRenderGrid = false) {
      let parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 0) parsed = 0;
      availablePlates[plateId] = parsed;

      if (reRenderGrid) {
        updateUI(false);
      } else {
        const totalKg = calculateTotalWeightKg();
        const totalLb = totalKg * 2.20462;
        const roundedKg = Math.round(totalKg * 10) / 10;
        const roundedLb = Math.round(totalLb * 10) / 10;
        const totalBadge = document.getElementById('barbellTotalBadge');
        if (totalBadge) {
          totalBadge.textContent = `Total: ${roundedKg} kg / ${roundedLb} lb`;
        }
        renderBarbellSVG();
      }
    }

    function addPlateGraphicClick(plateId) {
      if (plateViewMode === 'sled') {
        if (availablePlates[plateId] >= 1) {
          availablePlates[plateId] -= 1;
          const sledPlate = plateDefinitions.find(p => p.id === plateId);
          if (sledPlate) {
            loadedSledPlates.push(sledPlate);
            syncTargetFromLoaded();
          }
        } else {
          showToast('No plates of that size left in stock');
        }
        return;
      }
      if (availablePlates[plateId] >= 2) {
        availablePlates[plateId] -= 2;
        const plateObj = plateDefinitions.find(p => p.id === plateId);
        if (plateObj) {
          loadedPlatesPerSide.push(plateObj);
          syncTargetFromLoaded();
        }
      } else {
        showToast('Not enough available inventory plates (requires pair)');
      }
    }

    function unloadPlateFromBar(sortedIndex) {
      if (sortedIndex >= 0 && sortedIndex < loadedPlatesPerSide.length) {
        const removedPlate = loadedPlatesPerSide.splice(sortedIndex, 1)[0];
        availablePlates[removedPlate.id] = (availablePlates[removedPlate.id] || 0) + 2;
        syncTargetFromLoaded();
      }
    }

    function unloadPlateFromSled(sortedIndex) {
      if (sortedIndex >= 0 && sortedIndex < loadedSledPlates.length) {
        const removedPlate = loadedSledPlates.splice(sortedIndex, 1)[0];
        availablePlates[removedPlate.id] = (availablePlates[removedPlate.id] || 0) + 1;
        syncTargetFromLoaded();
      }
    }

    // ---- Barbell <-> Sled view switching ---------------------------------
    function returnLoadedPlatesToStock() {
      loadedPlatesPerSide.forEach(p => {
        availablePlates[p.id] = (availablePlates[p.id] || 0) + 2;
      });
      loadedSledPlates.forEach(p => {
        availablePlates[p.id] = (availablePlates[p.id] || 0) + 1;
      });
      loadedPlatesPerSide = [];
      loadedSledPlates = [];
    }

    function setTargetInput(value, unit) {
      const targetEl = document.getElementById('targetWeight');
      const unitEl = document.getElementById('loaderUnit');
      if (unitEl && unit) unitEl.value = unit;
      if (targetEl) targetEl.value = value;
    }

    function setPlateViewMode(mode) {
      if ((mode !== 'barbell' && mode !== 'sled') || mode === plateViewMode) return;

      // Remember where this view was, free its plates, then restore the other view.
      const targetEl = document.getElementById('targetWeight');
      const unitEl = document.getElementById('loaderUnit');
      modeTargets[plateViewMode] = {
        value: targetEl ? targetEl.value : '',
        unit: unitEl ? unitEl.value : 'kg'
      };

      returnLoadedPlatesToStock();
      plateViewMode = mode;

      const saved = modeTargets[mode] || { value: mode === 'sled' ? sledBaseWeightKg : 100, unit: 'kg' };
      setTargetInput(saved.value, saved.unit);
      calculateFromTarget();
    }

    function onSledBaseWeightInput() {
      const el = document.getElementById('sledBaseWeight');
      const val = parseFloat(el ? el.value : '');
      sledBaseWeightKg = Number.isFinite(val) && val >= 0 ? val : 0;
      if (plateViewMode === 'sled') syncTargetFromLoaded();
    }

    function loadSledPreset(totalKg) {
      if (plateViewMode !== 'sled') setPlateViewMode('sled');
      setTargetInput(totalKg, 'kg');   // HYROX weights are kg; avoids lb round-trip drift
      calculateFromTarget();

      const loadedKg = calculateTotalWeightKg();
      if (Math.abs(loadedKg - totalKg) > 0.01) {
        showToast(`Can only reach ${Math.round(loadedKg * 10) / 10} kg with the current stock / sled weight`);
      }
    }

   function applyDefaultInventory() {
  loadedPlatesPerSide = [];
  loadedSledPlates = [];
  availablePlates = { ...defaultInventory };
  calculateFromTarget();
}

function resetPlatesInventory() {
  applyDefaultInventory();
  showToast('Inventory reset to default stock');
}

function renderPlateSettings() {
  const grid = document.getElementById('plateDefaultsGrid');
  if (!grid) return;

  const row = plate => `
    <div class="flex items-center justify-between gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-3 h-3 rounded-full flex-shrink-0 border border-slate-600" style="background:${plate.color}"></span>
        <span class="text-slate-200 font-semibold truncate">${plate.weight} ${plate.unit}</span>
      </div>
      <input type="number" inputmode="numeric" min="0" max="99" data-plate-default="${plate.id}"
             value="${defaultInventory[plate.id] ?? 0}"
             class="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white font-bold focus:outline-none focus:border-emerald-500">
    </div>`;

  const group = (title, unit) => `
    <div class="space-y-1.5">
      <div class="text-[11px] font-bold text-slate-400">${title}</div>
      <div class="grid grid-cols-2 gap-1.5">
        ${plateDefinitions.filter(p => p.unit === unit).map(row).join('')}
      </div>
    </div>`;

  grid.innerHTML = group('Kilogram plates', 'kg') + group('Pound plates', 'lb');
}

function savePlateDefaults() {
  const next = { ...factoryInventory };
  document.querySelectorAll('[data-plate-default]').forEach(input => {
    let n = parseInt(input.value, 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
    next[input.dataset.plateDefault] = Math.min(n, 99);
  });
  defaultInventory = next;
  try { localStorage.setItem(PLATE_DEFAULTS_KEY, JSON.stringify(defaultInventory)); } catch (e) {}
  applyDefaultInventory();
  renderPlateSettings();
  showToast('Plate defaults saved');
}

function resetPlateDefaultsToFactory() {
  try { localStorage.removeItem(PLATE_DEFAULTS_KEY); } catch (e) {}
  defaultInventory = { ...factoryInventory };
  applyDefaultInventory();
  renderPlateSettings();
  showToast('Plate defaults restored to factory');
}

    // Side-on sled: base plate with ski tips, push posts either side, and a
    // central loading pin. Plates stack flat on the pin, heaviest at the bottom,
    // in the same colour scheme as plateDefinitions.
    function renderSledSVG(container) {
      const cx = 400;
      const baseTop = 204;
      const baseHeight = 20;
      const groundY = baseTop + baseHeight;
      const postTop = 18;
      const pinTop = 34;
      const pinHalf = 7;

      // Thickness scales down if the stack would grow past the top of the pin.
      const maxStackHeight = baseTop - 56;
      const naturalStackHeight = loadedSledPlates.reduce((sum, p) => sum + p.width * 1.25, 0);
      const scale = naturalStackHeight > maxStackHeight ? maxStackHeight / naturalStackHeight : 1;

      let y = baseTop;
      let platesMarkup = '';

      loadedSledPlates.forEach((plate, index) => {
        const t = Math.max(4, plate.width * 1.25 * scale);
        const rx = (plate.height * 1.7) / 2;
        const ry = Math.max(3, Math.min(6.5, rx * 0.14));
        const yBottom = y;
        const yTop = y - t;
        y = yTop;

        const body = `M ${cx - rx} ${yTop} L ${cx - rx} ${yBottom} A ${rx} ${ry} 0 0 0 ${cx + rx} ${yBottom} L ${cx + rx} ${yTop} Z`;
        const textColor = plate.textColor || '#ffffff';
        const label = plate.unit === 'lb' ? `${plate.weight}lb` : `${plate.weight}`;
        const fontSize = Math.min(12, t * 0.62);
        const showText = t >= 11;
        const textY = yTop + ry + t / 2 + fontSize * 0.35;

        platesMarkup += `
          <g class="sled-plate" onclick="unloadPlateFromSled(${index})">
            <title>Click to unload: ${plate.weight} ${plate.unit}</title>
            <path d="${body}" fill="${plate.color}" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round" />
            <path d="${body}" fill="url(#sledPlateShade)" />
            <ellipse cx="${cx}" cy="${yTop}" rx="${rx}" ry="${ry}" fill="${plate.color}" stroke="#0f172a" stroke-width="1.5" />
            <ellipse cx="${cx}" cy="${yTop}" rx="${rx}" ry="${ry}" fill="rgba(255,255,255,0.16)" />
            <ellipse cx="${cx}" cy="${yTop}" rx="${pinHalf + 2.5}" ry="${Math.max(1.8, ry * 0.5)}" fill="#0f172a" />
            ${showText ? `<text x="${cx}" y="${textY}" fill="${textColor}" stroke="#0f172a" stroke-width="0.3" font-size="${fontSize}" font-weight="900" font-family="sans-serif" text-anchor="middle">${label}</text>` : ''}
          </g>
        `;
      });

      // Pin rises out of the top plate (or the base when the sled is empty).
      const topY = y;
      const post = x => `<rect x="${x}" y="${postTop}" width="12" height="${baseTop - postTop}" rx="3" fill="url(#sledPostGrad)" stroke="#0f172a" stroke-width="1" />`;

      const plateKg = loadedSledPlates.reduce((sum, p) => sum + getPlateWeightInKg(p), 0);
      const plateKgRounded = Math.round(plateKg * 10) / 10;
      const caption = loadedSledPlates.length === 0
        ? `Sled Weight: ${sledBaseWeightKg} kg (Empty)`
        : `Sled ${sledBaseWeightKg} kg + Plates ${plateKgRounded} kg`;

      container.innerHTML = `
        <svg viewBox="60 0 680 260" class="w-full h-auto max-h-[260px] select-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sledMetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#64748b" />
              <stop offset="35%" stop-color="#334155" />
              <stop offset="100%" stop-color="#0f172a" />
            </linearGradient>
            <linearGradient id="sledPostGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#4b5563" />
              <stop offset="45%" stop-color="#111827" />
              <stop offset="100%" stop-color="#1f2937" />
            </linearGradient>
            <linearGradient id="sledPlateShade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="rgba(255,255,255,0.22)" />
              <stop offset="35%" stop-color="rgba(255,255,255,0)" />
              <stop offset="100%" stop-color="rgba(0,0,0,0.38)" />
            </linearGradient>
            <linearGradient id="sledTurfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#166534" />
              <stop offset="100%" stop-color="#14532d" />
            </linearGradient>
          </defs>

          <!-- turf -->
          <rect x="0" y="${groundY}" width="800" height="${260 - groundY}" fill="url(#sledTurfGrad)" />
          <rect x="100" y="${groundY}" width="600" height="4" fill="rgba(0,0,0,0.25)" />

          <!-- ski tips + base plate -->
          <polygon points="150,${baseTop} 112,${baseTop} 90,${baseTop + 12} 112,${groundY} 150,${groundY}" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round" />
          <polygon points="650,${baseTop} 688,${baseTop} 710,${baseTop + 12} 688,${groundY} 650,${groundY}" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round" />
          <rect x="150" y="${baseTop}" width="500" height="${baseHeight}" rx="2" fill="url(#sledMetalGrad)" stroke="#0f172a" stroke-width="1.5" />
          <circle cx="330" cy="${baseTop + 10}" r="4.5" fill="#94a3b8" stroke="#0f172a" stroke-width="1.5" />
          <circle cx="470" cy="${baseTop + 10}" r="4.5" fill="#94a3b8" stroke="#0f172a" stroke-width="1.5" />

          <!-- push posts -->
          ${post(198)}${post(222)}${post(566)}${post(590)}
          <rect x="190" y="${baseTop - 14}" width="52" height="14" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
          <rect x="558" y="${baseTop - 14}" width="52" height="14" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />

          <!-- plates -->
          ${platesMarkup}

          <!-- loading pin -->
          <rect x="${cx - pinHalf}" y="${pinTop}" width="${pinHalf * 2}" height="${topY - pinTop}" rx="3" fill="url(#sledPostGrad)" stroke="#0f172a" stroke-width="1" />
          <ellipse cx="${cx}" cy="${topY}" rx="${pinHalf}" ry="2.4" fill="#1f2937" stroke="#0f172a" stroke-width="1" />
          <rect x="${cx - pinHalf + 2}" y="${pinTop + 1}" width="${pinHalf * 2 - 4}" height="3" rx="1.5" fill="rgba(255,255,255,0.22)" />

          <text x="${cx}" y="${groundY + 23}" fill="#dcfce7" font-size="12" font-weight="700" text-anchor="middle">${caption}</text>
        </svg>
      `;
    }

    function renderBarbellSVG() {
      const container = document.getElementById('barbellVisualizer');
      if (!container) return;

      if (plateViewMode === 'sled') {
        renderSledSVG(container);
        return;
      }

      const svgWidth = 800;
      const svgHeight = 210;
      const centerY = 105;

      const barShaftWidth = 360;
      const barShaftX = (svgWidth - barShaftWidth) / 2;
      const barHeight = 12;

      const sleeveWidth = 180;
      const leftSleeveX = barShaftX - sleeveWidth;
      const rightSleeveX = barShaftX + barShaftWidth;

      const collarWidth = 14;
      const collarHeight = 50;

      const baseTotalPlatesWidth = loadedPlatesPerSide.reduce((sum, p) => sum + (p.width * 1.5), 0);
      const maxAvailableSleeveWidth = sleeveWidth - 15;
      const scaleFactor = baseTotalPlatesWidth > maxAvailableSleeveWidth ? (maxAvailableSleeveWidth / baseTotalPlatesWidth) : 1;

      let leftPlateX = barShaftX - collarWidth;
      let rightPlateX = barShaftX + barShaftWidth + collarWidth;

      let leftPlatesMarkup = '';
      let rightPlatesMarkup = '';

      loadedPlatesPerSide.forEach((plate, index) => {
        const pWidth = Math.max(10, plate.width * 1.5 * scaleFactor);
        const pHeight = plate.height * 1.3;
        const pY = centerY - (pHeight / 2);
        const textColor = plate.textColor || '#ffffff';

        const isStackedClose = pWidth < 18;
        const showText = !isStackedClose && pHeight > 45 && pWidth >= 11;
        const fontSize = Math.min(10, Math.max(7, pWidth * 0.65));

        leftPlateX -= pWidth;
        const leftCx = leftPlateX + pWidth / 2;
        const leftCalloutY = pY - 10 - ((index % 2) * 12);

        leftPlatesMarkup += `
          <g class="cursor-pointer plate-hover" onclick="unloadPlateFromBar(${index})">
            <title>Click to unload pair: ${plate.weight} ${plate.unit}</title>
            <rect x="${leftPlateX}" y="${pY}" width="${Math.max(1, pWidth - 1)}" height="${pHeight}" rx="3" fill="${plate.color}" stroke="#0f172a" stroke-width="1.5" />
            <rect x="${leftPlateX + 2}" y="${pY + 3}" width="${Math.max(1, pWidth - 5)}" height="${pHeight - 6}" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
            
            ${isStackedClose ? `
              <line x1="${leftCx}" y1="${pY}" x2="${leftCx}" y2="${pY + pHeight}" stroke="rgba(255,255,255,0.7)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${leftCx}" y1="${pY}" x2="${leftCx}" y2="${leftCalloutY}" stroke="${plate.color}" stroke-width="1.5" stroke-dasharray="2 2" />
              <rect x="${leftCx - 10}" y="${leftCalloutY - 10}" width="20" height="10" rx="2" fill="#0f172a" stroke="${plate.color}" stroke-width="1" />
              <text x="${leftCx}" y="${leftCalloutY - 2}" fill="#ffffff" font-size="8" font-weight="800" font-family="sans-serif" text-anchor="middle">${plate.weight}</text>
            ` : ''}

            ${showText ? `
              <text x="${leftCx}" y="${centerY + 4}" fill="${textColor}" stroke="#0f172a" stroke-width="0.3" font-size="${fontSize}" font-weight="900" font-family="sans-serif" text-anchor="middle" transform="rotate(-90 ${leftCx} ${centerY})">${plate.weight}</text>
            ` : ''}
          </g>
        `;

        const rightCx = rightPlateX + pWidth / 2;
        const rightCalloutY = pY - 10 - ((index % 2) * 12);

        rightPlatesMarkup += `
          <g class="cursor-pointer plate-hover" onclick="unloadPlateFromBar(${index})">
            <title>Click to unload pair: ${plate.weight} ${plate.unit}</title>
            <rect x="${rightPlateX + 1}" y="${pY}" width="${Math.max(1, pWidth - 1)}" height="${pHeight}" rx="3" fill="${plate.color}" stroke="#0f172a" stroke-width="1.5" />
            <rect x="${rightPlateX + 3}" y="${pY + 3}" width="${Math.max(1, pWidth - 5)}" height="${pHeight - 6}" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
            
            ${isStackedClose ? `
              <line x1="${rightCx}" y1="${pY}" x2="${rightCx}" y2="${pY + pHeight}" stroke="rgba(255,255,255,0.7)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${rightCx}" y1="${pY}" x2="${rightCx}" y2="${rightCalloutY}" stroke="${plate.color}" stroke-width="1.5" stroke-dasharray="2 2" />
              <rect x="${rightCx - 10}" y="${rightCalloutY - 10}" width="20" height="10" rx="2" fill="#0f172a" stroke="${plate.color}" stroke-width="1" />
              <text x="${rightCx}" y="${rightCalloutY - 2}" fill="#ffffff" font-size="8" font-weight="800" font-family="sans-serif" text-anchor="middle">${plate.weight}</text>
            ` : ''}

            ${showText ? `
              <text x="${rightCx}" y="${centerY + 4}" fill="${textColor}" stroke="#0f172a" stroke-width="0.3" font-size="${fontSize}" font-weight="900" font-family="sans-serif" text-anchor="middle" transform="rotate(90 ${rightCx} ${centerY})">${plate.weight}</text>
            ` : ''}
          </g>
        `;
        rightPlateX += pWidth;
      });

      container.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="w-full h-auto max-h-[220px] select-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="metalBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#cbd5e1" />
              <stop offset="50%" stop-color="#64748b" />
              <stop offset="100%" stop-color="#334155" />
            </linearGradient>
            <linearGradient id="sleeveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#94a3b8" />
              <stop offset="50%" stop-color="#475569" />
              <stop offset="100%" stop-color="#1e293b" />
            </linearGradient>
          </defs>

          <rect x="${leftSleeveX}" y="${centerY - 10}" width="${sleeveWidth}" height="20" rx="2" fill="url(#sleeveGrad)" stroke="#334155" />
          <rect x="${rightSleeveX}" y="${centerY - 10}" width="${sleeveWidth}" height="20" rx="2" fill="url(#sleeveGrad)" stroke="#334155" />

          <rect x="${barShaftX}" y="${centerY - barHeight/2}" width="${barShaftWidth}" height="${barHeight}" rx="2" fill="url(#metalBarGrad)" />
          
          <rect x="${barShaftX + 110}" y="${centerY - barHeight/2}" width="140" height="${barHeight}" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2 2" />

          <rect x="${barShaftX - collarWidth}" y="${centerY - collarHeight/2}" width="${collarWidth}" height="${collarHeight}" rx="3" fill="url(#sleeveGrad)" stroke="#0f172a" />
          <rect x="${barShaftX + barShaftWidth}" y="${centerY - collarHeight/2}" width="${collarWidth}" height="${collarHeight}" rx="3" fill="url(#sleeveGrad)" stroke="#0f172a" />

          ${leftPlatesMarkup}
          ${rightPlatesMarkup}

          <text x="${svgWidth / 2}" y="${centerY + 45}" fill="#64748b" font-size="12" font-weight="600" text-anchor="middle">
            Barbell Weight: ${selectedBarWeightKg} kg${loadedPlatesPerSide.length === 0 ? ' (Empty)' : ''}
          </text>
        </svg>
      `;
    }

    function updateUI(recalc = true) {
      const totalKg = calculateTotalWeightKg();
      const totalLb = totalKg * 2.20462;
      const roundedKg = Math.round(totalKg * 10) / 10;
      const roundedLb = Math.round(totalLb * 10) / 10;
      const combinedDisplayStr = `${roundedKg} kg / ${roundedLb} lb`;

      const totalBadge = document.getElementById('barbellTotalBadge');
      if (totalBadge) {
        totalBadge.textContent = `Total: ${combinedDisplayStr}`;
      }

      renderPlateModeUI();
      renderBarbellSVG();
      renderInventoryGrid();
    }

    // Toggle buttons, view-specific fields/labels, and the HYROX preset panel.
    function renderPlateModeUI() {
      const isSled = plateViewMode === 'sled';

      const toggleBase = 'py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5';
      const toggleOn = 'bg-indigo-600 text-white shadow-md';
      const toggleOff = 'text-slate-300 hover:text-white hover:bg-slate-800';
      const barBtn = document.getElementById('plateModeBarbellBtn');
      const sledBtn = document.getElementById('plateModeSledBtn');
      if (barBtn) {
        barBtn.className = `${toggleBase} ${isSled ? toggleOff : toggleOn}`;
        barBtn.setAttribute('aria-pressed', String(!isSled));
      }
      if (sledBtn) {
        sledBtn.className = `${toggleBase} ${isSled ? toggleOn : toggleOff}`;
        sledBtn.setAttribute('aria-pressed', String(isSled));
      }

      const setHidden = (id, hidden) => document.getElementById(id)?.classList.toggle('hidden', hidden);
      const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      };

      setHidden('barbellWeightBlock', isSled);
      setHidden('sledWeightBlock', !isSled);
      setHidden('sledPresetPanel', !isSled);

      setText('visualizerTitle', isSled ? 'Sled Visualizer' : 'Barbell Visualizer');
      setText('targetWeightLabel', isSled ? 'Target Total Weight (incl. sled)' : 'Target Weight');
      setText('visualizerHint', isSled
        ? '💡 Click a plate on the sled to unload it. Click a plate in inventory below to stack one on.'
        : '💡 Click loaded plate to unload pair. Click plate in inventory below to add.');
      setText('inventoryHint', isSled
        ? 'Type exact quantities or tap plate graphic to stack onto the sled'
        : 'Type exact quantities or tap plate graphic to load onto bar');

      if (isSled) renderSledPresets();
    }

    function renderSledPresets() {
      const panel = document.getElementById('sledPresetPanel');
      if (!panel) return;
      const currentKg = calculateTotalWeightKg();

      const button = opt => {
        const active = Math.abs(currentKg - opt.kg) < 0.01;
        return `
          <button onclick="loadSledPreset(${opt.kg})"
                  class="plate-btn-touch min-h-[52px] px-1.5 py-2 rounded-lg border text-center leading-tight flex flex-col items-center justify-center transition active:scale-95 ${active ? 'bg-emerald-600 border-emerald-400 text-white shadow-md' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'}">
            <span class="text-[10px] font-semibold ${active ? 'text-emerald-50' : 'text-slate-400'}">${opt.label}</span>
            <span class="text-sm font-extrabold">${opt.kg} kg</span>
          </button>`;
      };

      panel.innerHTML = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200">🏁 HYROX Sled Quick Load</span>
            <span class="text-[10px] text-slate-500">Totals include the sled</span>
          </div>
          ${HYROX_SLED_PRESETS.map(group => `
            <div class="space-y-1.5">
              <div class="text-[11px] font-bold text-slate-400">${group.title}</div>
              <div class="grid grid-cols-3 gap-1.5">${group.options.map(button).join('')}</div>
            </div>`).join('')}
        </div>`;
    }

    function renderInventoryGrid() {
      const grid = document.getElementById('platesGrid');
      if (!grid) return;

      const isSled = plateViewMode === 'sled';
      const unitsPerLoad = isSled ? 1 : 2;   // sled takes single plates, barbell takes pairs
      const loadTitle = isSled
        ? 'Click plate graphic to stack 1 plate on the sled (Deducts 1 from stock)'
        : 'Click plate graphic to load 1 pair onto bar (Deducts 2 from stock)';

      grid.innerHTML = plateDefinitions.map(plate => {
        const qty = availablePlates[plate.id] || 0;
        const textColor = plate.textColor || '#ffffff';
        const weightLabel = `${plate.weight} ${plate.unit.toUpperCase()}`;

        return `
          <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-between text-center transition hover:border-slate-700">
            <div class="text-xs font-extrabold text-white mb-1">
              ${plate.weight} <span class="text-[10px] text-slate-400 font-medium">${plate.unit}</span>
            </div>

            <div onclick="addPlateGraphicClick('${plate.id}')" 
                 class="my-1 cursor-pointer plate-hover flex items-center justify-center p-1.5 rounded-lg bg-slate-950/40 w-full"
                 title="${loadTitle}">
              <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <path id="topArc_${plate.id}" d="M 13.5,30 A 16.5,16.5 0 0,1 46.5,30" fill="none" />
                  <path id="bottomArc_${plate.id}" d="M 46.5,30 A 16.5,16.5 0 0,1 13.5,30" fill="none" />
                </defs>

                <circle cx="30" cy="30" r="26" fill="${plate.color}" stroke="#0f172a" stroke-width="2" />
                <circle cx="30" cy="30" r="21" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
                
                <text fill="${textColor}" font-size="6.5" font-weight="800" font-family="sans-serif">
                  <textPath href="#topArc_${plate.id}" startOffset="50%" text-anchor="middle">${weightLabel}</textPath>
                </text>

                <text fill="${textColor}" font-size="6.5" font-weight="800" font-family="sans-serif">
                  <textPath href="#bottomArc_${plate.id}" startOffset="50%" text-anchor="middle">${weightLabel}</textPath>
                </text>

                <circle cx="30" cy="30" r="8.5" fill="#0f172a" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
              </svg>
            </div>
            
            <div class="w-full flex items-center justify-between bg-slate-950 rounded-lg p-1 border border-slate-800 mt-1">
              <button onclick="decrementInventory(event, '${plate.id}')" 
                      class="plate-btn-touch w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded-md text-sm transition shrink-0">
                -
              </button>
              
              <div class="flex items-center justify-center gap-1 mx-1 min-w-0">
                <span class="text-[10px] text-slate-400 font-medium">Qty:</span>
                <input type="number" min="0" max="99" value="${qty}" 
                       onclick="event.stopPropagation()" 
                       onchange="setInventoryQty('${plate.id}', this.value, true)" 
                       oninput="setInventoryQty('${plate.id}', this.value, false)" 
                       class="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs font-bold ${qty < unitsPerLoad ? 'text-rose-400' : 'text-emerald-400'}">
              </div>

              <button onclick="incrementInventory(event, '${plate.id}')" 
                      class="plate-btn-touch w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded-md text-sm transition shrink-0">
                +
              </button>
            </div>
          </div>
        `;
      }).join('');
    }


// --- Exports (referenced by onclick/onchange attributes in index.html,
//     or called from other module files) ---
window.getPlateWeightInKg = getPlateWeightInKg;
window.sortLoadedPlates = sortLoadedPlates;
window.calculateTotalWeightKg = calculateTotalWeightKg;
window.onBarWeightSelectChange = onBarWeightSelectChange;
window.onCustomBarInput = onCustomBarInput;
window.calculateFromTarget = calculateFromTarget;
window.syncTargetFromLoaded = syncTargetFromLoaded;
window.onTargetInputChanged = onTargetInputChanged;
window.onUnitChanged = onUnitChanged;
window.clearBarbell = clearBarbell;
window.incrementInventory = incrementInventory;
window.decrementInventory = decrementInventory;
window.setInventoryQty = setInventoryQty;
window.addPlateGraphicClick = addPlateGraphicClick;
window.unloadPlateFromBar = unloadPlateFromBar;
window.resetPlatesInventory = resetPlatesInventory;
window.applyDefaultInventory = applyDefaultInventory;
window.renderPlateSettings = renderPlateSettings;
window.savePlateDefaults = savePlateDefaults;
window.resetPlateDefaultsToFactory = resetPlateDefaultsToFactory;
window.renderBarbellSVG = renderBarbellSVG;
window.updateUI = updateUI;
window.renderInventoryGrid = renderInventoryGrid;
window.setPlateViewMode = setPlateViewMode;
window.loadSledPreset = loadSledPreset;
window.onSledBaseWeightInput = onSledBaseWeightInput;
window.unloadPlateFromSled = unloadPlateFromSled;
window.renderSledSVG = renderSledSVG;
window.renderPlateModeUI = renderPlateModeUI;