// =====================================================================
// lifting-log.js — Nyanletics: Lifting Log tab
// Owns: exercises[], oneRMManualOverrides, collapsedGroupsMap, the 1RM
// card, the weight-suggestions card, and the exercise log/edit/rename UI.
// Calls out to plate-loader.js's calculateFromTarget() in ONE place
// (loadSuggestedWeightToPlateCalculator) — that's the app's only
// intentional Lifting Log -> Plate Loader coupling; keep it that way
// rather than adding new cross-calls.
// NOTE: this state is NOT currently persisted to localStorage — it
// resets to the seed data below on every page reload. Worth fixing
// alongside the split (see chat).
// =====================================================================

let collapsedGroupsMap = {};

let exercises = [
  { id: 1, name: 'Push Ups', weight: 0, unit: 'kg', sets: 3, reps: 30, tempo: '2-0-1-0', isBW: true, date: '2026-03-23' },
  { id: 2, name: 'Dips', weight: 15, unit: 'kg', sets: 3, reps: 8, tempo: '2-0-1-0', isBW: true, date: '2026-03-22' },
  { id: 3, name: 'Squat', weight: 140, unit: 'kg', sets: 3, reps: 5, tempo: '2-0-1-0', isBW: false, date: '2026-03-20' },
  { id: 4, name: 'Bench Press', weight: 105, unit: 'kg', sets: 3, reps: 3, tempo: '2-0-1-0', isBW: false, date: '2026-03-23' },
  { id: 5, name: 'Pull Ups', weight: 0, unit: 'kg', sets: 4, reps: 10, tempo: '2-0-1-0', isBW: true, date: '2026-03-21' },
  { id: 6, name: 'Wall Balls', weight: 9, unit: 'kg', sets: 3, reps: 20, tempo: '1-0-1-0', isBW: false, date: '2026-03-23' }
];

let oneRMManualOverrides = {};

const LIFT_KEY = 'nyanletics_lifting_log', ORM_KEY = 'nyanletics_1rm_overrides';
function saveLifting() {
  try {
    localStorage.setItem(LIFT_KEY, JSON.stringify(exercises));
    localStorage.setItem(ORM_KEY, JSON.stringify(oneRMManualOverrides));
  } catch (e) { console.warn('lifting save failed', e); }
}
(function () {
  try {
    const s = JSON.parse(localStorage.getItem(LIFT_KEY));
    if (Array.isArray(s)) exercises = s;
    const o = JSON.parse(localStorage.getItem(ORM_KEY));
    if (o && typeof o === 'object') oneRMManualOverrides = o;
  } catch (e) {}
})();

    function isBodyweightMovementName(name) {
      if (!name) return false;
      const lower = name.toLowerCase();
      const bwKeywords = ['push up', 'pushup', 'dip', 'pull up', 'pullup', 'chin up', 'chinup', 'bodyweight', 'muscle up', 'body weight', 'bw', 'wall ball', 'wallball'];
      return bwKeywords.some(kw => lower.includes(kw));
    }

    function syncBWCheckbox(exerciseNameInput) {
      const bwCheckbox = document.getElementById('exerciseBW');
      if (!bwCheckbox) return;
      const name = (exerciseNameInput || '').trim();
      if (!name) return;
      const existingRecord = exercises.find(ex => ex.name.trim().toLowerCase() === name.toLowerCase());
      if (existingRecord) {
        bwCheckbox.checked = !!existingRecord.isBW;
      } else {
        bwCheckbox.checked = isBodyweightMovementName(name);
      }
    }

    function onBWCheckboxChange(context) {
      const isLog = context === 'log';
      const bwCheck = document.getElementById(isLog ? 'exerciseBW' : 'editBW');
      const weightInput = document.getElementById(isLog ? 'exerciseWeight' : 'editWeight');

      if (bwCheck && bwCheck.checked && weightInput) {
        if (!weightInput.value || parseFloat(weightInput.value) === 0) {
          weightInput.value = '0';
        }
      }
    }

    function getUniquePreviousExercises() {
      const names = new Set();
      const defaultList = ["Wall Balls", "Push Ups", "Dips", "Pull Ups", "Bench Press", "Squat", "Deadlift", "Shoulder Press", "Push Press", "Barbell Row"];
      defaultList.forEach(n => names.add(n));
      exercises.forEach(e => {
        if (e.name && e.name.trim()) {
          names.add(e.name.trim());
        }
      });
      return Array.from(names);
    }

    function handleExerciseInput() {
      const input = document.getElementById('exerciseName');
      const container = document.getElementById('exerciseSuggestions');
      if (!input || !container) return;
      const query = input.value.trim().toLowerCase();
      syncBWCheckbox(query);
      const uniqueList = getUniquePreviousExercises();
      const matches = uniqueList.filter(name => name.toLowerCase().includes(query));
      if (matches.length === 0) {
        container.classList.add('hidden');
        return;
      }
      container.innerHTML = matches.map(name => `
        <div onclick="selectSuggestion('${name.replace(/'/g, "\\'")}')" 
             class="px-3.5 py-2 hover:bg-indigo-600/30 text-xs text-slate-200 cursor-pointer font-medium transition flex items-center justify-between border-b border-slate-800/50 last:border-0">
          <span>${name}</span>
          <span class="text-[10px] text-slate-500">Select</span>
        </div>
      `).join('');
      container.classList.remove('hidden');
    }

    function selectSuggestion(name) {
      const input = document.getElementById('exerciseName');
      const sugg = document.getElementById('exerciseSuggestions');
      if (input) input.value = name;
      if (sugg) sugg.classList.add('hidden');
      syncBWCheckbox(name);
      document.getElementById('exerciseWeight')?.focus();
    }

    function toggle1RMCard() {
      const content = document.getElementById('oneRMContent');
      const chevron = document.getElementById('oneRMChevron');
      if (content && chevron) {
        if (content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          chevron.textContent = '▲ Hide';
        } else {
          content.classList.add('hidden');
          chevron.textContent = '▼ Show';
        }
      }
    }

    function toggleSuggestionsCard() {
      const content = document.getElementById('suggestionsContent');
      const chevron = document.getElementById('suggestionsChevron');
      if (content && chevron) {
        if (content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          chevron.textContent = '▲ Hide';
        } else {
          content.classList.add('hidden');
          chevron.textContent = '▼ Show';
        }
      }
    }

    function updateSuggestionsSelect() {
      const select = document.getElementById('suggestionExerciseSelect');
      if (!select) return;
      const uniqueNames = Array.from(new Set(exercises.map(e => e.name.trim()))).filter(Boolean);
      if (uniqueNames.length === 0) {
        select.innerHTML = `<option value="">No exercises logged</option>`;
        return;
      }
      const currentVal = select.value;
      select.innerHTML = uniqueNames.map(name => `
        <option value="${name.replace(/"/g, '&quot;')}" ${name === currentVal ? 'selected' : ''}>${name}</option>
      `).join('');
      if (!currentVal || !uniqueNames.includes(currentVal)) {
        select.value = uniqueNames[0];
      }
      onSuggestionExerciseChange();
    }

    function onSuggestionExerciseChange() {
      const select = document.getElementById('suggestionExerciseSelect');
      if (!select) return;
      const selectedName = select.value;
      if (!selectedName) {
        renderWeightSuggestions();
        return;
      }
      let topRecord = null;
      let top1RMKg = -1;
      exercises.forEach(ex => {
        if (ex.name.toLowerCase() === selectedName.toLowerCase()) {
          const wKg = ex.unit === 'kg' ? ex.weight : ex.weight * 0.45359237;
          const systemWeightKg = ex.isBW ? (70 + wKg) : wKg;
          const e1rm = calculate1RM(systemWeightKg, ex.reps);
          if (e1rm > top1RMKg) {
            top1RMKg = e1rm;
            topRecord = ex;
          }
        }
      });
      if (topRecord) {
        const targetSetsInput = document.getElementById('suggestionTargetSets');
        const targetRepsInput = document.getElementById('suggestionTargetReps');
        const targetTempoInput = document.getElementById('suggestionTargetTempo');
        if (targetSetsInput) targetSetsInput.value = topRecord.sets || 3;
        if (targetRepsInput) targetRepsInput.value = topRecord.reps || 10;
        if (targetTempoInput) targetTempoInput.value = formatTempo(topRecord.tempo || '2-0-1-0');
      }
      renderWeightSuggestions();
    }

    function renderWeightSuggestions() {
      const select = document.getElementById('suggestionExerciseSelect');
      const targetSetsInput = document.getElementById('suggestionTargetSets');
      const targetRepsInput = document.getElementById('suggestionTargetReps');
      const targetTempoInput = document.getElementById('suggestionTargetTempo');
      const resultBox = document.getElementById('suggestionResultBox');
      if (!select || !resultBox) return;

      const selectedName = select.value;
      const targetSets = parseInt(targetSetsInput?.value) || 3;
      let targetReps = parseInt(targetRepsInput?.value) || 8;
      const targetTempoStr = formatTempo(targetTempoInput?.value || '2-0-1-0');

      if (!selectedName) {
        resultBox.innerHTML = `<p class="text-xs text-slate-500 italic">No saved records found for suggestion.</p>`;
        return;
      }

      let topRecord = null;
      let top1RMKg = -1;
      exercises.forEach(ex => {
        if (ex.name.toLowerCase() === selectedName.toLowerCase()) {
          const wKg = ex.unit === 'kg' ? ex.weight : ex.weight * 0.45359237;
          const systemWeightKg = ex.isBW ? (75 * 0.68 + wKg) : wKg;
          const e1rm = calculate1RM(systemWeightKg, ex.reps);
          if (e1rm > top1RMKg) {
            top1RMKg = e1rm;
            topRecord = ex;
          }
        }
      });

      if (!topRecord) {
        resultBox.innerHTML = `<p class="text-xs text-slate-500 italic">No saved set found for ${selectedName}.</p>`;
        return;
      }

      const baseSets = topRecord.sets || 3;
      const baseReps = topRecord.reps;
      const baseWeight = topRecord.weight;
      const baseUnit = topRecord.unit;
      const baseTempoStr = formatTempo(topRecord.tempo || '2-0-1-0');
      const isBW = !!topRecord.isBW;

      const baseAddedKg = baseUnit === 'kg' ? baseWeight : baseWeight * 0.45359237;
      const assumedBWKg = 75;
      const systemBaseKg = isBW ? (assumedBWKg * 0.68 + baseAddedKg) : baseAddedKg;
      
      const estimated1RMSystemKg = calculate1RM(systemBaseKg, baseReps);
      const targetSystemKg = estimated1RMSystemKg / (1 + (targetReps / 30));

      const targetRepDuration = parseTempoDuration(targetTempoStr);
      const baseRepDuration = parseTempoDuration(baseTempoStr);
      const tutSetSeconds = Math.round(targetReps * targetRepDuration * 10) / 10;

      const alphaTempo = 1 - 0.025 * (targetRepDuration - baseRepDuration);
      const adjustedTargetSystemKg = targetSystemKg * alphaTempo;

      let targetKgToLoad = 0;
      let targetWeightDisplay = '';

      if (isBW) {
        const suggestedAddedKg = adjustedTargetSystemKg - (assumedBWKg * 0.68);
        targetKgToLoad = suggestedAddedKg > 0 ? Math.round(suggestedAddedKg * 10) / 10 : 0;
        const valInUnit = baseUnit === 'kg' ? Math.max(0, suggestedAddedKg) : Math.max(0, suggestedAddedKg) * 2.20462;
        const roundedAdded = Math.round(valInUnit * 2) / 2;
        targetWeightDisplay = roundedAdded > 0 ? `Body Weight + ${roundedAdded} ${baseUnit}` : `Body Weight`;
      } else {
        targetKgToLoad = Math.round(adjustedTargetSystemKg * 10) / 10;
        const valInUnit = baseUnit === 'kg' ? adjustedTargetSystemKg : adjustedTargetSystemKg * 2.20462;
        const roundedTarget = Math.round(valInUnit * 2) / 2;
        targetWeightDisplay = `${roundedTarget} ${baseUnit}`;
      }

      const tempoPctChange = Math.round((alphaTempo - 1) * 1000) / 10;
      const tempoBadgeClass = tempoPctChange < 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 
                              (tempoPctChange > 0 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-300 border-slate-700');

      const repGoals = isBW && baseAddedKg === 0 ? [10, 15, 20, 25, 30] : [3, 5, 8, 10, 12];
      const quickTableHtml = repGoals.map(r => {
        const rawTargetSys = estimated1RMSystemKg / (1 + (r / 30));
        const adjSys = rawTargetSys * alphaTempo;
        const isCurrentTarget = r === targetReps;
        
        let displayLabel = '';
        if (isBW) {
          let addKg = adjSys - (assumedBWKg * 0.68);
          if (addKg < 0) addKg = 0;
          const addVal = baseUnit === 'kg' ? addKg : addKg * 2.20462;
          const rAdded = Math.round(addVal * 2) / 2;
          displayLabel = rAdded > 0 ? `Body Weight + ${rAdded}${baseUnit}` : 'Body Weight';
        } else {
          const valForR = baseUnit === 'kg' ? adjSys : adjSys * 2.20462;
          const roundedR = Math.round(valForR * 2) / 2;
          displayLabel = `${roundedR}${baseUnit}`;
        }

        return `
          <div onclick="selectTargetRepsGoal(${r})" class="cursor-pointer p-2 rounded-lg border text-center transition ${isCurrentTarget ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'}">
            <div class="text-[10px] text-slate-400 font-medium">${targetSets} × ${r} reps</div>
            <div class="text-xs font-extrabold mt-0.5">${displayLabel}</div>
          </div>
        `;
      }).join('');

      const baseWeightDisplay = isBW ? (baseWeight > 0 ? `Body Weight + ${baseWeight} ${baseUnit}` : 'Body Weight') : `${baseWeight} ${baseUnit}`;

      resultBox.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div class="text-xs text-slate-400 flex items-center gap-1">
              <span>🏆 Top Recorded Performance:</span>
            </div>
            <div class="text-sm font-bold text-slate-200">
              ${selectedName}: <span class="text-indigo-400">${baseSets} sets × ${baseReps} reps @ ${baseWeightDisplay}</span> 
              <span class="text-xs text-slate-400 font-mono">(${baseTempoStr})</span>
            </div>
          </div>
          <button onclick="loadSuggestedWeightToPlateCalculator(${targetKgToLoad})" class="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition">
            🏋️ Load ${targetKgToLoad} kg in Plate Loader
          </button>
        </div>

        <div class="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3 text-center space-y-1">
          <div class="text-xs text-emerald-400 font-bold uppercase tracking-wider">Suggested Working Target</div>
          <div class="text-xl sm:text-2xl font-black text-emerald-300 my-0.5">
            ${targetSets} sets × ${targetReps} reps @ ${targetWeightDisplay}
          </div>
          <div class="flex items-center justify-center gap-2 flex-wrap text-[11px]">
            <span class="text-indigo-300">TUT: <strong>${tutSetSeconds}s</strong> / set</span>
            <span class="text-slate-500">•</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tempoBadgeClass}">
              Tempo Adj: ${tempoPctChange > 0 ? '+' : ''}${tempoPctChange}%
            </span>
          </div>
        </div>

        <div>
          <div class="text-[11px] font-semibold text-slate-400 mb-1.5">Quick Target Breakdown (${targetSets} Sets @ Tempo <span class="text-slate-300 font-mono">${targetTempoStr}</span>):</div>
          <div class="grid grid-cols-5 gap-1.5">
            ${quickTableHtml}
          </div>
        </div>
      `;
    }

    function selectTargetRepsGoal(reps) {
      const input = document.getElementById('suggestionTargetReps');
      if (input) {
        input.value = reps;
        renderWeightSuggestions();
      }
    }

    function loadSuggestedWeightToPlateCalculator(targetKg) {
      const targetEl = document.getElementById('targetWeight');
      const unitEl = document.getElementById('loaderUnit');
      if (unitEl) unitEl.value = 'kg';
      if (targetEl) targetEl.value = targetKg;
      switchTab('plates');
      calculateFromTarget();
      showToast(`Loaded ${targetKg} kg into Plate Loader`);
    }

    function calculate1RM(weight, reps) {
      if (weight <= 0 || !reps || reps <= 0) return 0;
      if (reps === 1) return weight;
      return weight * (1 + (reps / 30));
    }

    function render1RMCard() {
      const targetLifts = [
        { key: 'Wall Balls / Thrusters', matchNames: ['wall ball', 'wallball', 'thruster', 'med ball', 'medicine ball'] },
        { key: 'Push Ups / Dips', matchNames: ['push up', 'pushup', 'dip', 'pull up', 'pullup', 'chin up'] },
        { key: 'Shoulder Press / OHP', matchNames: ['shoulder press', 'overhead press', 'ohp', 'military press'] },
        { key: 'Squat', matchNames: ['squat', 'back squat', 'front squat'] },
        { key: 'Bench Press', matchNames: ['bench press', 'bench', 'flat bench'] },
        { key: 'Deadlift', matchNames: ['deadlift', 'sumo deadlift', 'conventional deadlift'] }
      ];

      const grid = document.getElementById('oneRMGrid');
      if (!grid) return;

      grid.innerHTML = targetLifts.map(lift => {
        let best1RMKg = 0;
        let bestSetInfo = 'No sets logged';
        exercises.forEach(ex => {
          const nameLower = ex.name.toLowerCase();
          const matches = lift.matchNames.some(m => nameLower.includes(m));
          if (matches) {
            const wKg = ex.unit === 'kg' ? ex.weight : ex.weight * 0.45359237;
            const e1rmKg = calculate1RM(wKg, ex.reps);
            if (e1rmKg >= best1RMKg) {
              best1RMKg = e1rmKg;
              const wStr = ex.isBW ? (ex.weight > 0 ? `Body Weight + ${ex.weight}${ex.unit}` : 'Body Weight') : `${ex.weight}${ex.unit}`;
              bestSetInfo = `${ex.sets || 3} × ${ex.reps} reps @ ${wStr}`;
            }
          }
        });

        const finalKg = oneRMManualOverrides[lift.key] || best1RMKg;
        const displayKg = (Math.round(finalKg * 10) / 10);
        const displayLb = (Math.round(finalKg * 2.20462 * 10) / 10);

        return `
          <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-200">${lift.key}</div>
              <div class="text-[10px] text-slate-400">Top set: ${bestSetInfo}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-extrabold text-emerald-400">
                ${finalKg > 0 ? `${displayKg} kg` : '--'}
              </div>
              <div class="text-[10px] text-slate-400">
                ${finalKg > 0 ? `${displayLb} lb` : 'Added 1RM'}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function addExercise() {
      const nameInput = document.getElementById('exerciseName');
      const weightInput = document.getElementById('exerciseWeight');
      const unitInput = document.getElementById('exerciseUnit');
      const setsInput = document.getElementById('exerciseSets');
      const repsInput = document.getElementById('exerciseReps');
      const tempoInput = document.getElementById('exerciseTempo');
      const bwInput = document.getElementById('exerciseBW');

      const name = nameInput?.value.trim();
      const rawWeight = parseFloat(weightInput?.value);
      const isBW = bwInput ? bwInput.checked : isBodyweightMovementName(name);
      const weight = isNaN(rawWeight) ? 0 : rawWeight;
      const unit = unitInput?.value || 'kg';
      const sets = parseInt(setsInput?.value) || 3;
      const reps = parseInt(repsInput?.value);
      const tempo = formatTempo(tempoInput?.value || '2-0-1-0');

      if (name && !isNaN(reps)) {
        const today = new Date().toISOString().split('T')[0];
        exercises.unshift({ 
          id: Date.now(), 
          name, 
          weight, 
          unit, 
          sets,
          reps, 
          tempo, 
          isBW,
          date: today 
        });

        if (nameInput) nameInput.value = '';
        if (weightInput) weightInput.value = '';
        if (setsInput) setsInput.value = '3';
        if (repsInput) repsInput.value = '';
        if (tempoInput) tempoInput.value = '2-0-1-0';
        if (bwInput) bwInput.checked = false;
        document.getElementById('exerciseSuggestions')?.classList.add('hidden');

        collapsedGroupsMap[name.toLowerCase()] = false;

        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
        showToast(`Logged set record for ${name}`);
      }
    }

    function deleteExercise(id) {
      exercises = exercises.filter(e => e.id !== id);
      renderExercises();
      render1RMCard();
      updateSuggestionsSelect();
    }

    function deleteGroup(exerciseName) {
      exercises = exercises.filter(e => e.name.toLowerCase() !== exerciseName.toLowerCase());
      renderExercises();
      render1RMCard();
      updateSuggestionsSelect();
      showToast(`Deleted all records for ${exerciseName}`);
    }

    function openRenameGroupModal(oldDisplayName) {
      const elKey = document.getElementById('renameOldGroupKey');
      const elInput = document.getElementById('renameNewGroupInput');
      if (elKey) elKey.value = oldDisplayName;
      if (elInput) elInput.value = oldDisplayName;
      document.getElementById('renameGroupModal')?.classList.remove('hidden');
    }

    function closeRenameGroupModal() {
      document.getElementById('renameGroupModal')?.classList.add('hidden');
    }

    function saveGroupRename() {
      const oldName = document.getElementById('renameOldGroupKey')?.value.trim();
      const newName = document.getElementById('renameNewGroupInput')?.value.trim();
      if (oldName && newName) {
        exercises = exercises.map(ex => {
          if (ex.name.toLowerCase() === oldName.toLowerCase()) {
            return { ...ex, name: newName };
          }
          return ex;
        });
        closeRenameGroupModal();
        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
        showToast('Updated exercise group name');
      }
    }

    function openEditModal(id) {
      const record = exercises.find(e => e.id === id);
      if (!record) return;
      document.getElementById('editId').value = record.id;
      document.getElementById('editName').value = record.name;
      document.getElementById('editWeight').value = record.weight;
      document.getElementById('editUnit').value = record.unit;
      document.getElementById('editSets').value = record.sets || 3;
      document.getElementById('editReps').value = record.reps;
      document.getElementById('editTempo').value = formatTempo(record.tempo || '2-0-1-0');
      document.getElementById('editBW').checked = !!record.isBW;
      document.getElementById('editModal')?.classList.remove('hidden');
    }

    function closeEditModal() {
      document.getElementById('editModal')?.classList.add('hidden');
    }

    function saveEditModal() {
      const id = parseInt(document.getElementById('editId')?.value);
      const name = document.getElementById('editName')?.value.trim();
      const rawWeight = parseFloat(document.getElementById('editWeight')?.value);
      const isBW = document.getElementById('editBW')?.checked || false;
      const weight = isNaN(rawWeight) ? 0 : rawWeight;
      const unit = document.getElementById('editUnit')?.value;
      const sets = parseInt(document.getElementById('editSets')?.value) || 3;
      const reps = parseInt(document.getElementById('editReps')?.value);
      const tempo = formatTempo(document.getElementById('editTempo')?.value || '2-0-1-0');

      if (id && name && !isNaN(reps)) {
        exercises = exercises.map(ex => {
          if (ex.id === id) {
            return { ...ex, name, weight, unit, sets, reps, tempo, isBW };
          }
          return ex;
        });
        closeEditModal();
        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
      }
    }

    function toggleGroupCollapse(groupKey) {
      collapsedGroupsMap[groupKey] = !collapsedGroupsMap[groupKey];
      renderExercises();
    }

    function toggleAllGroups(expand) {
      const searchInput = document.getElementById('searchLog')?.value || '';
      const searchQuery = searchInput.toLowerCase().trim();
      exercises.forEach(ex => {
        const normKey = ex.name.trim().toLowerCase();
        if (!searchQuery || normKey.includes(searchQuery)) {
          collapsedGroupsMap[normKey] = !expand;
        }
      });
      renderExercises();
    }

    function renderExercises() {
      const list = document.getElementById('exercisesList');
      if (!list) return;

      const searchQuery = (document.getElementById('searchLog')?.value || '').toLowerCase().trim();
      const filtered = exercises.filter(ex => ex.name.toLowerCase().includes(searchQuery));

      if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center text-xs text-slate-500 py-8 bg-slate-900/40 rounded-xl border border-slate-800">
          ${searchQuery ? 'No matching exercise records found.' : 'No lifting sets logged yet.'}
        </div>`;
        return;
      }

      const groups = {};
      filtered.forEach(ex => {
        const key = ex.name.trim();
        const normKey = key.toLowerCase();
        if (!groups[normKey]) {
          groups[normKey] = { displayName: key, items: [] };
        }
        groups[normKey].items.push(ex);
      });

      list.innerHTML = Object.keys(groups).map((groupKey) => {
        const group = groups[groupKey];
        const count = group.items.length;
        const isCollapsed = !!collapsedGroupsMap[groupKey];
        const maxSet = group.items.reduce((max, item) => {
          const itemKg = item.unit === 'kg' ? item.weight : item.weight * 0.45359237;
          const maxKg = max.unit === 'kg' ? max.weight : max.weight * 0.45359237;
          return itemKg > maxKg ? item : max;
        }, group.items[0]);

        const maxSetKg = maxSet.unit === 'kg' ? maxSet.weight : Math.round(maxSet.weight * 0.45359237 * 10) / 10;
        const maxSetLb = maxSet.unit === 'lb' ? maxSet.weight : Math.round(maxSet.weight * 2.20462 * 10) / 10;
        const maxSetLabel = maxSet.isBW ? (maxSet.weight > 0 ? `Body Weight + ${maxSetKg} kg` : 'Body Weight') : `${maxSetKg} kg (${maxSetLb} lb)`;

        return `
          <div class="glass-card rounded-xl border border-slate-800 overflow-hidden shadow-md">
            <div class="p-3 bg-slate-900/90 flex items-center justify-between border-b border-slate-800/80">
              <div onclick="toggleGroupCollapse('${groupKey}')" class="flex items-center gap-2.5 cursor-pointer flex-1">
                <span class="text-xs text-indigo-400 font-bold transition-transform">
                  ${isCollapsed ? '▶' : '▼'}
                </span>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-extrabold text-white">${group.displayName}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                      ${count} ${count === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
                  Top: ${maxSetLabel}
                </span>
                <button onclick="openRenameGroupModal('${group.displayName.replace(/'/g, "\\'")}')" class="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition" title="Rename Exercise Group">
                  ✏️ Rename
                </button>
                <button onclick="deleteGroup('${group.displayName.replace(/'/g, "\\'")}')" class="text-xs text-slate-500 hover:text-rose-400 p-1" title="Delete Entire Group">
                  🗑️
                </button>
              </div>
            </div>

            <div class="${isCollapsed ? 'hidden' : ''} divide-y divide-slate-800/60 bg-slate-950/40">
              ${group.items.map(item => {
                const itemKg = item.unit === 'kg' ? item.weight : Math.round(item.weight * 0.45359237 * 10) / 10;
                const itemLb = item.unit === 'lb' ? item.weight : Math.round(item.weight * 2.20462 * 10) / 10;
                const setVal = item.sets || 3;
                const formattedTempo = formatTempo(item.tempo);

                let weightLabelHtml = '';
                if (item.isBW) {
                  weightLabelHtml = item.weight > 0 ? 
                    `<span class="text-sm font-bold text-emerald-400">Body Weight + ${itemKg} kg <span class="text-xs font-normal text-slate-400">(${itemLb} lb)</span></span>` : 
                    `<span class="text-sm font-bold text-emerald-400">Body Weight</span>`;
                } else {
                  weightLabelHtml = `<span class="text-sm font-bold text-emerald-400">${itemKg} kg <span class="text-xs font-normal text-slate-400">(${itemLb} lb)</span></span>`;
                }

                return `
                <div class="p-3 flex items-center justify-between hover:bg-slate-800/40 transition">
                  <div class="space-y-0.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      ${weightLabelHtml}
                      <span class="text-xs text-slate-300 font-medium">× ${setVal}${setVal === 1 ? 'set' : 'sets'} × ${item.reps} reps</span>${formattedTempo ? `<span class="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono">⏱ ${formattedTempo}</span>` : ''}
                    </div>
                    <div class="text-[10px] text-slate-500">${item.date || 'Recent set'}</div>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <button onclick="openEditModal(${item.id})" class="text-xs font-semibold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded transition border border-slate-700">
                      Edit
                    </button>
                    <button onclick="deleteExercise(${item.id})" class="text-xs font-semibold px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition">
                      Delete
                    </button>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }


// --- Exports (referenced by onclick/onchange attributes in index.html,
//     or called from other module files) ---
window.isBodyweightMovementName = isBodyweightMovementName;
window.syncBWCheckbox = syncBWCheckbox;
window.onBWCheckboxChange = onBWCheckboxChange;
window.parseTempoDuration = parseTempoDuration;
window.getUniquePreviousExercises = getUniquePreviousExercises;
window.handleExerciseInput = handleExerciseInput;
window.selectSuggestion = selectSuggestion;
window.toggle1RMCard = toggle1RMCard;
window.toggleSuggestionsCard = toggleSuggestionsCard;
window.updateSuggestionsSelect = updateSuggestionsSelect;
window.onSuggestionExerciseChange = onSuggestionExerciseChange;
window.renderWeightSuggestions = renderWeightSuggestions;
window.selectTargetRepsGoal = selectTargetRepsGoal;
window.loadSuggestedWeightToPlateCalculator = loadSuggestedWeightToPlateCalculator;
window.calculate1RM = calculate1RM;
window.render1RMCard = render1RMCard;
window.addExercise = addExercise;
window.deleteExercise = deleteExercise;
window.deleteGroup = deleteGroup;
window.openRenameGroupModal = openRenameGroupModal;
window.closeRenameGroupModal = closeRenameGroupModal;
window.saveGroupRename = saveGroupRename;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEditModal = saveEditModal;
window.toggleGroupCollapse = toggleGroupCollapse;
window.toggleAllGroups = toggleAllGroups;
window.renderExercises = renderExercises;
