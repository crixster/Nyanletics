// =====================================================================
// macro-tracker.js — Apex Fitness: Macro Tracker tab
// Owns: currentDate, goals, foodLogs, favourites, geminiApiKey and all
// Gemini vision-scan / food-entry / favourites UI. This is the ONLY
// module that reads/writes localStorage today (apex_macro_goals,
// apex_gemini_key, apex_food_logs, apex_favourites).
// =====================================================================

let currentDate = new Date();
let editingMacroId = null;
let editingMacroDateKey = null; // which foodLogs[] day-bucket editingMacroId belongs to
let goals = { cal: 2000, p: 150, c: 200, f: 65 };
let foodLogs = {}; // Format: 'YYYY-MM-DD': [{ id, name, cal, p, c, f, portion, baseCal, baseP, baseC, baseF }]
let favourites = [];
let editingFavouriteId = null;
let geminiApiKey = '';
  let GEMINI_PREFERRED_MODEL = 'gemini-3.8-flash';
  let GEMINI_FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.7-flash'];
  let cachedWorkingGeminiModel = null;

    function loadSettings() {
      const savedGoals = localStorage.getItem('apex_macro_goals');
      if (savedGoals) {
        try { goals = JSON.parse(savedGoals); } catch(e) {}
      }
      const savedKey = localStorage.getItem('apex_gemini_key');
      if (savedKey) geminiApiKey = savedKey;

      const savedLogs = localStorage.getItem('apex_food_logs');
      if (savedLogs) {
        try { foodLogs = JSON.parse(savedLogs); } catch(e) {}
      }

      const savedFavs = localStorage.getItem('apex_favourites');
      if (savedFavs) {
        try { favourites = JSON.parse(savedFavs); } catch(e) {}
      } else {
        favourites = [
          { id: 101, name: 'Grilled Chicken Breast', cal: 165, p: 31, c: 0, f: 3.6, portion: 1 },
          { id: 102, name: 'Oatmeal & Milk', cal: 250, p: 10, c: 42, f: 5, portion: 1 },
          { id: 103, name: 'Protein Shake (Whey)', cal: 120, p: 24, c: 3, f: 1.5, portion: 1 }
        ];
        saveFavourites();
      }
    }

    function saveFavourites() {
      localStorage.setItem('apex_favourites', JSON.stringify(favourites));
    }

    function getGeminiApiKey() {
    return geminiApiKey || localStorage.getItem('apex_gemini_key') || '';
  }

  function renderSettings() {
    document.getElementById('gemini-key-input').value = getGeminiApiKey();
    document.getElementById('goal-cal-input').value = goals.cal;
    document.getElementById('goal-p-input').value = goals.p;
    document.getElementById('goal-c-input').value = goals.c;
    document.getElementById('goal-f-input').value = goals.f;
  }

  function saveGeminiKey() {
    geminiApiKey = document.getElementById('gemini-key-input').value.trim();
    localStorage.setItem('apex_gemini_key', geminiApiKey);
    showToast(geminiApiKey ? 'API key saved' : 'API key cleared');
  }

  function saveMacroTargets() {
    const cal = parseInt(document.getElementById('goal-cal-input').value) || 2000;
    const p = parseInt(document.getElementById('goal-p-input').value) || 150;
    const c = parseInt(document.getElementById('goal-c-input').value) || 200;
    const f = parseInt(document.getElementById('goal-f-input').value) || 65;
    goals = { cal, p, c, f };
    localStorage.setItem('apex_macro_goals', JSON.stringify(goals));
    renderSettings();
    showToast('Macro targets saved');
  }

  // Kept so old callers still work; they now land on the Settings tab
  function openSettings() { switchTab('settings'); }
  function closeSettings() {}
  function saveSettings() { saveGeminiKey(); saveMacroTargets(); }

    function formatDateKey(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function parseDateKey(key) {
      const [year, month, day] = key.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    function formatDisplayDate(date) {
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'long' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    }

    function formatDisplayTime(msTimestamp) {
      const d = new Date(msTimestamp);
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    function toDatetimeLocalValue(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function fromDatetimeLocalValue(value) {
      if (!value || typeof value !== 'string') return null;
      const [datePart, timePart] = value.split('T');
      if (!datePart || !timePart) return null;
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      if ([year, month, day, hours, minutes].some(n => Number.isNaN(n))) return null;
      return new Date(year, month - 1, day, hours, minutes, 0, 0);
    }

    function changeDate(delta) {
      currentDate.setDate(currentDate.getDate() + delta);
      renderDay();
    }

    function renderDay() {
      const key = formatDateKey(currentDate);

      const dateDisplay = document.getElementById('current-date-display');
      if (dateDisplay) {
        dateDisplay.textContent = formatDisplayDate(currentDate);
      }

      document.getElementById('goal-cal-display').textContent = goals.cal;
      document.getElementById('goal-p-display').textContent = goals.p;
      document.getElementById('goal-c-display').textContent = goals.c;
      document.getElementById('goal-f-display').textContent = goals.f;

      const dayLogs = foodLogs[key] || [];

      let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
      dayLogs.forEach(item => {
        totalCal += Number(item.cal) || 0;
        totalP += Number(item.p) || 0;
        totalC += Number(item.c) || 0;
        totalF += Number(item.f) || 0;
      });

      document.getElementById('summary-cal').textContent = Math.round(totalCal);
      document.getElementById('summary-p').textContent = `${Math.round(totalP)}g`;
      document.getElementById('summary-c').textContent = `${Math.round(totalC)}g`;
      document.getElementById('summary-f').textContent = `${Math.round(totalF)}g`;

      const barCal = document.getElementById('bar-cal');
      const barP = document.getElementById('bar-p');
      const barC = document.getElementById('bar-c');
      const barF = document.getElementById('bar-f');

      if (barCal) barCal.style.width = `${Math.min(100, (totalCal / goals.cal) * 100)}%`;
      if (barP) barP.style.width = `${Math.min(100, (totalP / goals.p) * 100)}%`;
      if (barC) barC.style.width = `${Math.min(100, (totalC / goals.c) * 100)}%`;
      if (barF) barF.style.width = `${Math.min(100, (totalF / goals.f) * 100)}%`;

      renderFoodList();
      renderFavouritesList();
    }

    function renderFoodList() {
      const listContainer = document.getElementById('food-list');
      if (!listContainer) return;

      const dateKeys = Object.keys(foodLogs).filter(key => (foodLogs[key] || []).length > 0);

      if (dateKeys.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center text-xs text-slate-500 py-6 bg-slate-900/40 rounded-xl border border-slate-800">
            No food items logged yet.
          </div>
        `;
        return;
      }

      // Newest day first ('YYYY-MM-DD' keys sort correctly as strings).
      dateKeys.sort((a, b) => b.localeCompare(a));

      listContainer.innerHTML = dateKeys.map(dateKey => {
        // Newest logged time first within the day. Uses the user-editable
        // `loggedAt` timestamp when present; older entries saved before
        // date/time editing existed fall back to `id` (which was Date.now()
        // at creation time, i.e. their original implicit log time).
        const items = [...foodLogs[dateKey]].sort((a, b) => (b.loggedAt || b.id || 0) - (a.loggedAt || a.id || 0));
        const dayLabel = formatDisplayDate(parseDateKey(dateKey));

        const itemsHtml = items.map(item => {
          const portionLabel = item.portion && item.portion !== 1 ? ` (${item.portion}x portion)` : '';
          const isFav = favourites.some(f => f.name.toLowerCase() === item.name.toLowerCase());
          const timeLabel = formatDisplayTime(item.loggedAt || item.id);

          return `
            <div class="glass-card p-3 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition">
              <div class="space-y-0.5">
                <div class="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                  <span>${item.name}</span>
                  <span class="text-[10px] text-emerald-400 font-semibold">${portionLabel}</span>
                  <span class="text-[10px] text-slate-500 font-medium">• ${timeLabel}</span>
                </div>
                <div class="text-[11px] text-slate-400 flex items-center gap-2">
                  <span class="font-bold text-slate-200">${item.cal} kcal</span>
                  <span>•</span>
                  <span>P: ${item.p}g</span>
                  <span>C: ${item.c}g</span>
                  <span>F: ${item.f}g</span>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <button onclick="toggleSaveAsFavouriteFromLog(${item.id}, '${dateKey}')" class="text-xs px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 transition" title="${isFav ? 'In Favourites' : 'Save as Favourite'}">
                  ${isFav ? '★ Saved' : '☆ Fav'}
                </button>
                <button onclick="openFormModal(${item.id}, '${dateKey}')" class="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 transition">
                  Edit
                </button>
                <button onclick="deleteFoodEntry(${item.id}, '${dateKey}')" class="text-xs text-slate-500 hover:text-rose-400 p-1" title="Delete Entry">
                  🗑️
                </button>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="space-y-2">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">${dayLabel}</div>
            <div class="space-y-2">
              ${itemsHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    function toggleFavouritesCard() {
      const content = document.getElementById('favsContent');
      const chevron = document.getElementById('favsChevron');
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

    function renderFavouritesList() {
      const listContainer = document.getElementById('favouritesList');
      if (!listContainer) return;

      const searchInput = (document.getElementById('favSearchInput')?.value || '').toLowerCase().trim();
      const filtered = favourites.filter(f => f.name.toLowerCase().includes(searchInput));

      if (filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center text-xs text-slate-500 py-3 bg-slate-900/40 rounded-xl border border-slate-800">
            ${searchInput ? 'No matching favourite foods found.' : 'No favourites saved yet. Click ☆ Fav on any logged item or check "Save to Favourites" when adding.'}
          </div>
        `;
        return;
      }

      listContainer.innerHTML = filtered.map(fav => `
        <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between hover:border-amber-500/30 transition">
          <div class="space-y-0.5">
            <div class="text-xs font-bold text-amber-300 flex items-center gap-1">
              <span>⭐ ${fav.name}</span>
            </div>
            <div class="text-[10px] text-slate-400">
              <span class="font-bold text-slate-200">${fav.cal} kcal</span> (P: ${fav.p}g | C: ${fav.c}g | F: ${fav.f}g) per serving
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="addFavouriteToDayPrompt(${fav.id})" class="text-xs px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold rounded-lg transition flex items-center gap-1">
              <span>+ Add</span>
            </button>
            <button onclick="openEditFavouriteModal(${fav.id})" class="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 transition" title="Edit Favourite">
              Edit
            </button>
            <button onclick="removeFavourite(${fav.id})" class="text-xs text-slate-500 hover:text-rose-400 p-1" title="Remove Favourite">
              🗑️
            </button>
          </div>
        </div>
      `).join('');
    }

    function addFavouriteToDayPrompt(favId) {
      const fav = favourites.find(f => f.id === favId);
      if (!fav) return;

      editingMacroId = null;
      editingMacroDateKey = null;
      document.getElementById('modal-title').textContent = `Add Favourite: ${fav.name}`;
      document.getElementById('food-name-input').value = fav.name;
      document.getElementById('food-portion-input').value = fav.portion || 1;
      const favDatetimeInput = document.getElementById('food-datetime-input');
      if (favDatetimeInput) favDatetimeInput.value = toDatetimeLocalValue(new Date());
      
      const modal = document.getElementById('entry-modal');
      modal.dataset.baseCal = fav.cal;
      modal.dataset.baseP = fav.p;
      modal.dataset.baseC = fav.c;
      modal.dataset.baseF = fav.f;

      document.getElementById('food-cal-input').value = fav.cal;
      document.getElementById('food-p-input').value = fav.p;
      document.getElementById('food-c-input').value = fav.c;
      document.getElementById('food-f-input').value = fav.f;

      const saveFavCb = document.getElementById('save-as-fav-checkbox');
      if (saveFavCb) saveFavCb.checked = true;

      modal.classList.remove('hidden');
    }

    function onPortionInputChange() {
      const modal = document.getElementById('entry-modal');
      const portionVal = parseFloat(document.getElementById('food-portion-input').value) || 1;
      
      const baseCal = parseFloat(modal.dataset.baseCal);
      const baseP = parseFloat(modal.dataset.baseP);
      const baseC = parseFloat(modal.dataset.baseC);
      const baseF = parseFloat(modal.dataset.baseF);

      if (!isNaN(baseCal)) {
        document.getElementById('food-cal-input').value = Math.round(baseCal * portionVal);
        document.getElementById('food-p-input').value = Math.round(baseP * portionVal * 10) / 10;
        document.getElementById('food-c-input').value = Math.round(baseC * portionVal * 10) / 10;
        document.getElementById('food-f-input').value = Math.round(baseF * portionVal * 10) / 10;
      }
    }

    function removeFavourite(favId) {
      favourites = favourites.filter(f => f.id !== favId);
      saveFavourites();
      renderFavouritesList();
      showToast('Removed from favourites');
    }

    function openEditFavouriteModal(favId) {
      const fav = favourites.find(f => f.id === favId);
      if (!fav) return;

      editingFavouriteId = favId;

      document.getElementById('edit-fav-name-input').value = fav.name;
      document.getElementById('edit-fav-portion-input').value = fav.portion || 1;
      document.getElementById('edit-fav-cal-input').value = fav.cal;
      document.getElementById('edit-fav-p-input').value = fav.p;
      document.getElementById('edit-fav-c-input').value = fav.c;
      document.getElementById('edit-fav-f-input').value = fav.f;

      document.getElementById('edit-favourite-modal')?.classList.remove('hidden');
    }

    function closeEditFavouriteModal() {
      document.getElementById('edit-favourite-modal')?.classList.add('hidden');
      editingFavouriteId = null;
    }

    function saveEditFavourite() {
      if (!editingFavouriteId) return;

      const name = document.getElementById('edit-fav-name-input').value.trim();
      const portion = parseFloat(document.getElementById('edit-fav-portion-input').value) || 1;
      const cal = parseFloat(document.getElementById('edit-fav-cal-input').value) || 0;
      const p = parseFloat(document.getElementById('edit-fav-p-input').value) || 0;
      const c = parseFloat(document.getElementById('edit-fav-c-input').value) || 0;
      const f = parseFloat(document.getElementById('edit-fav-f-input').value) || 0;

      if (!name) {
        showToast('Please enter a food name');
        return;
      }

      const index = favourites.findIndex(fav => fav.id === editingFavouriteId);
      if (index === -1) {
        closeEditFavouriteModal();
        return;
      }

      favourites[index] = { ...favourites[index], name, portion, cal, p, c, f };

      saveFavourites();
      closeEditFavouriteModal();
      renderFavouritesList();
      showToast(`Updated "${name}" in favourites`);
    }

    function toggleSaveAsFavouriteFromLog(itemId, dateKey) {
      const key = dateKey || formatDateKey(currentDate);
      const dayLogs = foodLogs[key] || [];
      const item = dayLogs.find(i => i.id === itemId);
      if (!item) return;

      const existingIndex = favourites.findIndex(f => f.name.toLowerCase() === item.name.toLowerCase());
      if (existingIndex >= 0) {
        favourites.splice(existingIndex, 1);
        showToast(`Removed "${item.name}" from favourites`);
      } else {
        const basePortion = item.portion || 1;
        const baseCal = Math.round(item.cal / basePortion);
        const baseP = Math.round((item.p / basePortion) * 10) / 10;
        const baseC = Math.round((item.c / basePortion) * 10) / 10;
        const baseF = Math.round((item.f / basePortion) * 10) / 10;

        favourites.push({
          id: Date.now(),
          name: item.name,
          cal: baseCal,
          p: baseP,
          c: baseC,
          f: baseF,
          portion: 1
        });
        showToast(`Saved "${item.name}" to favourites`);
      }

      saveFavourites();
      renderDay();
    }

    function openFormModal(id = null, dateKey = null) {
      editingMacroId = id;
      editingMacroDateKey = id ? (dateKey || formatDateKey(currentDate)) : null;
      const modal = document.getElementById('entry-modal');
      const titleEl = document.getElementById('modal-title');
      const saveFavCb = document.getElementById('save-as-fav-checkbox');

      delete modal.dataset.baseCal;
      delete modal.dataset.baseP;
      delete modal.dataset.baseC;
      delete modal.dataset.baseF;

      if (id) {
        const key = editingMacroDateKey;
        const item = (foodLogs[key] || []).find(i => i.id === id);
        if (item) {
          if (titleEl) titleEl.textContent = 'Edit Food Entry';
          document.getElementById('food-name-input').value = item.name;
          document.getElementById('food-portion-input').value = item.portion || 1;
          const editDatetimeInput = document.getElementById('food-datetime-input');
          if (editDatetimeInput) editDatetimeInput.value = toDatetimeLocalValue(new Date(item.loggedAt || item.id));
          document.getElementById('food-cal-input').value = item.cal;
          document.getElementById('food-p-input').value = item.p;
          document.getElementById('food-c-input').value = item.c;
          document.getElementById('food-f-input').value = item.f;

          const basePortion = item.portion || 1;
          modal.dataset.baseCal = item.baseCal || Math.round(item.cal / basePortion);
          modal.dataset.baseP = item.baseP || (item.p / basePortion);
          modal.dataset.baseC = item.baseC || (item.c / basePortion);
          modal.dataset.baseF = item.baseF || (item.f / basePortion);

          if (saveFavCb) {
            saveFavCb.checked = favourites.some(f => f.name.toLowerCase() === item.name.toLowerCase());
          }
        }
      } else {
        if (titleEl) titleEl.textContent = 'Add Food Entry';
        document.getElementById('food-name-input').value = '';
        document.getElementById('food-portion-input').value = 1;
        const newDatetimeInput = document.getElementById('food-datetime-input');
        if (newDatetimeInput) newDatetimeInput.value = toDatetimeLocalValue(new Date());
        document.getElementById('food-cal-input').value = '';
        document.getElementById('food-p-input').value = '';
        document.getElementById('food-c-input').value = '';
        document.getElementById('food-f-input').value = '';
        if (saveFavCb) saveFavCb.checked = false;
      }

      modal.classList.remove('hidden');
    }

    function closeFormModal() {
      document.getElementById('entry-modal').classList.add('hidden');
      editingMacroId = null;
      editingMacroDateKey = null;
    }

    function saveFoodEntry() {
      const name = document.getElementById('food-name-input').value.trim();
      const portion = parseFloat(document.getElementById('food-portion-input').value) || 1;
      const cal = parseFloat(document.getElementById('food-cal-input').value) || 0;
      const p = parseFloat(document.getElementById('food-p-input').value) || 0;
      const c = parseFloat(document.getElementById('food-c-input').value) || 0;
      const f = parseFloat(document.getElementById('food-f-input').value) || 0;
      const saveAsFav = document.getElementById('save-as-fav-checkbox')?.checked || false;

      if (!name) {
        showToast('Please enter a food name');
        return;
      }

      // The Date & Time field is user-editable (defaults to "now") so foods
      // can be logged retroactively for earlier in the day, or an earlier
      // day entirely. That chosen date is what decides which day-bucket in
      // foodLogs{} the entry lives under — it overrides the Date Navigator's
      // currently-selected day, both for new entries and edits.
      const datetimeInputVal = document.getElementById('food-datetime-input')?.value;
      const loggedAtDate = fromDatetimeLocalValue(datetimeInputVal) || new Date();
      const loggedAt = loggedAtDate.getTime();
      const newKey = formatDateKey(loggedAtDate);

      const modal = document.getElementById('entry-modal');
      const baseCal = modal.dataset.baseCal ? parseFloat(modal.dataset.baseCal) : Math.round(cal / portion);
      const baseP = modal.dataset.baseP ? parseFloat(modal.dataset.baseP) : Math.round((p / portion) * 10) / 10;
      const baseC = modal.dataset.baseC ? parseFloat(modal.dataset.baseC) : Math.round((c / portion) * 10) / 10;
      const baseF = modal.dataset.baseF ? parseFloat(modal.dataset.baseF) : Math.round((f / portion) * 10) / 10;

      if (!foodLogs[newKey]) foodLogs[newKey] = [];

      if (editingMacroId) {
        // Editing an existing entry: if the date was changed to a different
        // day, move the item out of its old day-bucket and into the new one
        // (keeping the same id so favourites/edit/delete references still work).
        const oldKey = editingMacroDateKey || newKey;
        const updatedItem = { id: editingMacroId, name, cal, p, c, f, portion, baseCal, baseP, baseC, baseF, loggedAt };

        if (oldKey !== newKey) {
          if (foodLogs[oldKey]) {
            foodLogs[oldKey] = foodLogs[oldKey].filter(item => item.id !== editingMacroId);
          }
          foodLogs[newKey].push(updatedItem);
        } else {
          foodLogs[newKey] = foodLogs[newKey].map(item => item.id === editingMacroId ? updatedItem : item);
        }
      } else {
        foodLogs[newKey].push({
          id: Date.now(),
          name,
          cal,
          p,
          c,
          f,
          portion,
          baseCal,
          baseP,
          baseC,
          baseF,
          loggedAt
        });
      }

      if (saveAsFav) {
        const existingFavIndex = favourites.findIndex(fav => fav.name.toLowerCase() === name.toLowerCase());
        const favObj = {
          id: existingFavIndex >= 0 ? favourites[existingFavIndex].id : Date.now(),
          name,
          cal: baseCal,
          p: baseP,
          c: baseC,
          f: baseF,
          portion: 1
        };
        if (existingFavIndex >= 0) {
          favourites[existingFavIndex] = favObj;
        } else {
          favourites.push(favObj);
        }
        saveFavourites();
      }

      localStorage.setItem('apex_food_logs', JSON.stringify(foodLogs));
      closeFormModal();
      renderDay();

      // If the entry was logged to a different day than the one currently
      // shown in the Date Navigator, say so — otherwise the Daily Summary
      // cards (which only total the navigator's selected day) won't visibly
      // change even though the entry saved successfully.
      const loggedToDifferentDay = newKey !== formatDateKey(currentDate);
      const actionLabel = editingMacroId ? 'Updated' : 'Added';
      showToast(loggedToDifferentDay
        ? `${actionLabel} food entry for ${formatDisplayDate(loggedAtDate)}`
        : `${actionLabel} food entry`);
    }

    function deleteFoodEntry(id, dateKey) {
      const key = dateKey || formatDateKey(currentDate);
      if (foodLogs[key]) {
        foodLogs[key] = foodLogs[key].filter(item => item.id !== id);
        localStorage.setItem('apex_food_logs', JSON.stringify(foodLogs));
        renderDay();
        showToast('Food entry deleted');
      }
    }

    async function findWorkingGeminiModel(apiKey) {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(listUrl);
      if (!res.ok) throw new Error(`Could not list Gemini models (HTTP ${res.status})`);
      const data = await res.json();
      const models = (data.models || [])
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => (m.name || '').replace(/^models\//, ''))
        .filter(id => /flash|pro/i.test(id) && !/vision-latest|deprecated/i.test(id));

      if (models.length === 0) throw new Error('No usable Gemini models found for this API key');

      // Prefer "flash" models (fast + vision-capable + cheaper), newest version first.
      models.sort((a, b) => {
        const aFlash = /flash/i.test(a) ? 1 : 0;
        const bFlash = /flash/i.test(b) ? 1 : 0;
        if (aFlash !== bFlash) return bFlash - aFlash;
        return b.localeCompare(a, undefined, { numeric: true });
      });

      return models[0];
    }

    async function callGeminiVision(apiKey, payload) {
      const candidates = [GEMINI_PREFERRED_MODEL, ...GEMINI_FALLBACK_MODELS];
      if (cachedWorkingGeminiModel && !candidates.includes(cachedWorkingGeminiModel)) {
        candidates.unshift(cachedWorkingGeminiModel);
      }

      let lastError = null;
      for (const modelId of candidates) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
            cachedWorkingGeminiModel = modelId;
            return { modelId, data: await response.json() };
          }
          lastError = new Error(`${modelId} responded with HTTP ${response.status}`);
        } catch (err) {
          lastError = err;
        }
      }

      // Every known model name failed — search the live model list for a
      // working alternative as a last resort.
      const discoveredModel = await findWorkingGeminiModel(apiKey);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${discoveredModel}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`API Error ${response.status} (last tried: ${discoveredModel}). ${lastError ? lastError.message : ''}`.trim());
      }
      cachedWorkingGeminiModel = discoveredModel;
      return { modelId: discoveredModel, data: await response.json() };
    }

    function setScanStatus(message, isError) {
      const statusEl = document.getElementById('scan-status');
      const statusText = document.getElementById('scan-status-text');
      if (!statusEl || !statusText) return;
      statusEl.classList.remove('hidden');
      statusText.textContent = message;
      statusEl.classList.toggle('border-rose-500/50', !!isError);
      statusEl.classList.toggle('border-emerald-500/30', !isError);
      const icon = statusEl.querySelector('i');
      if (icon) {
        icon.className = isError
          ? 'fa-solid fa-triangle-exclamation text-rose-400 text-xl'
          : 'fa-solid fa-circle-notch fa-spin text-emerald-400 text-xl';
      }
      statusText.classList.toggle('text-rose-300', !!isError);
      statusText.classList.toggle('text-slate-200', !isError);
    }

    async function handleImageScan(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!geminiApiKey) {
        showToast('Please add your Gemini API key in Settings first!');
        switchTab('settings');
        return;
      }

      // Starting a new scan always resets any error left visible from a
      // previous attempt.
      setScanStatus(`Connecting to Gemini (${cachedWorkingGeminiModel || GEMINI_PREFERRED_MODEL})...`, false);

      try {
        const reader = new FileReader();
        reader.onload = async function(e) {
          try {
            const base64Data = e.target.result.split(',')[1];
            const mimeType = file.type || 'image/jpeg';

            const promptText = "Analyze this food image or nutritional label. Identify the food item and estimate/extract the nutrition facts per serving: food name, calories (kcal), protein (g), carbs (g), fat (g). Return ONLY a JSON object with keys: name (string), cal (number), p (number), c (number), f (number). Do not include markdown code block formatting.";

            const payload = {
              contents: [{
                parts: [
                  { text: promptText },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }]
            };

            setScanStatus(`Analyzing image with ${cachedWorkingGeminiModel || GEMINI_PREFERRED_MODEL}...`, false);

            const { modelId, data } = await callGeminiVision(geminiApiKey, payload);
            setScanStatus(`Analyzing image with ${modelId}...`, false);

            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

            let parsed = {};
            try {
              parsed = JSON.parse(cleanText);
            } catch (err) {
              throw new Error(`${modelId} returned a response that could not be parsed as JSON`);
            }

            document.getElementById('scan-status')?.classList.add('hidden');

            openFormModal();
            document.getElementById('food-name-input').value = parsed.name || 'Scanned Food Item';
            document.getElementById('food-cal-input').value = parsed.cal || 0;
            document.getElementById('food-p-input').value = parsed.p || 0;
            document.getElementById('food-c-input').value = parsed.c || 0;
            document.getElementById('food-f-input').value = parsed.f || 0;

            showToast(`Image analyzed with ${modelId}! Verify values and save.`);
          } catch (err) {
            // Leave the error message visible in the scan status card
            // (rather than hiding it) until the next scan is started.
            setScanStatus(`AI Scan failed: ${err.message || 'Unknown error'}`, true);
          }
        };
        reader.onerror = function() {
          setScanStatus('AI Scan failed: could not read the selected image file', true);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setScanStatus(`AI Scan failed: ${err.message || 'Unknown error'}`, true);
      }
    }


// --- Exports (referenced by onclick/onchange attributes in index.html,
//     or called from other module files) ---
window.loadSettings = loadSettings;
window.saveFavourites = saveFavourites;
window.saveSettings = saveSettings;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.renderSettings = renderSettings;
window.saveGeminiKey = saveGeminiKey;
window.saveMacroTargets = saveMacroTargets;
window.getGeminiApiKey = getGeminiApiKey;
window.formatDateKey = formatDateKey;
window.parseDateKey = parseDateKey;
window.formatDisplayDate = formatDisplayDate;
window.formatDisplayTime = formatDisplayTime;
window.toDatetimeLocalValue = toDatetimeLocalValue;
window.fromDatetimeLocalValue = fromDatetimeLocalValue;
window.changeDate = changeDate;
window.renderDay = renderDay;
window.renderFoodList = renderFoodList;
window.toggleFavouritesCard = toggleFavouritesCard;
window.renderFavouritesList = renderFavouritesList;
window.addFavouriteToDayPrompt = addFavouriteToDayPrompt;
window.onPortionInputChange = onPortionInputChange;
window.removeFavourite = removeFavourite;
window.openEditFavouriteModal = openEditFavouriteModal;
window.closeEditFavouriteModal = closeEditFavouriteModal;
window.saveEditFavourite = saveEditFavourite;
window.toggleSaveAsFavouriteFromLog = toggleSaveAsFavouriteFromLog;
window.openFormModal = openFormModal;
window.closeFormModal = closeFormModal;
window.saveFoodEntry = saveFoodEntry;
window.deleteFoodEntry = deleteFoodEntry;
window.findWorkingGeminiModel = findWorkingGeminiModel;
window.callGeminiVision = callGeminiVision;
window.setScanStatus = setScanStatus;
window.handleImageScan = handleImageScan;
