// =====================================================================
// plate-loader.js — Apex Fitness: Plate Loader tab
// Owns: plateDefinitions, availablePlates inventory, loadedPlatesPerSide,
// selectedBarWeightKg, the barbell SVG visualizer and inventory grid.
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
  { id: 'white1kg', name: 'Change White', weight: 1, unit: 'kg', color: '#e2e8f0', textColor: '#0f172a', height: 44, width: 10 },

  { id: 'black45lb', name: 'Bumper 45lb', weight: 45, unit: 'lb', color: '#334155', height: 110, width: 18 },
  { id: 'black35lb', name: 'Bumper 35lb', weight: 35, unit: 'lb', color: '#475569', height: 100, width: 17 },
  { id: 'black25lb', name: 'Bumper 25lb', weight: 25, unit: 'lb', color: '#64748b', height: 90, width: 15 },
  { id: 'grey10lb', name: 'Iron 10lb', weight: 10, unit: 'lb', color: '#94a3b8', textColor: '#0f172a', height: 75, width: 13 }
];

const defaultInventory = {
  red25kg: 16, blue20kg: 16, yellow15kg: 16, green10kg: 16, white5kg: 8,
  orange2d5kg: 2, yellow1d5kg: 2, white1kg: 2,
  black45lb: 16, black35lb: 16, black25lb: 16, grey10lb: 16
};

let availablePlates = { ...defaultInventory };
let loadedPlatesPerSide = [];
let selectedBarWeightKg = 20;

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
    }

    function calculateTotalWeightKg() {
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

    function resetPlatesInventory() {
      availablePlates = { ...defaultInventory };
      calculateFromTarget();
      showToast('Inventory reset to default stock');
    }

    function renderBarbellSVG() {
      const container = document.getElementById('barbellVisualizer');
      if (!container) return;

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

      renderBarbellSVG();
      renderInventoryGrid();
    }

    function renderInventoryGrid() {
      const grid = document.getElementById('platesGrid');
      if (!grid) return;
      
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
                 title="Click plate graphic to load 1 pair onto bar (Deducts 2 from stock)">
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
                       class="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs font-bold ${qty < 2 ? 'text-rose-400' : 'text-emerald-400'}">
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
window.renderBarbellSVG = renderBarbellSVG;
window.updateUI = updateUI;
window.renderInventoryGrid = renderInventoryGrid;
