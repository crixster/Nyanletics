// =====================================================================
// rehab.js — Apex Fitness: Rehab & Recovery Module
// Owns: Anatomical body map, muscle selection, custom routine builder,
// saved routines, and weekly schedule.
// =====================================================================

const MUSCLES = [
  {id:"chest", label:"Chest", views:["front"]},
  {id:"deltoid", label:"Shoulders", views:["front","back"]},
  {id:"biceps", label:"Biceps", views:["front"]},
  {id:"triceps", label:"Triceps", views:["back"]},
  {id:"abs", label:"Abs / Core", views:["front"]},
  {id:"obliques", label:"Obliques", views:["front"]},
  {id:"lats", label:"Back / Lats", views:["back"]},
  {id:"lowerback", label:"Lower Back", views:["back"]},
  {id:"glutes", label:"Glutes", views:["back"]},
  {id:"quads", label:"Quadriceps", views:["front"]},
  {id:"hamstrings", label:"Hamstrings", views:["back"]},
  {id:"calves", label:"Calves", views:["front","back"]},
  {id:"forearms", label:"Forearms", views:["front"]},
  {id:"neck", label:"Neck", views:["front","back"]}
];

const DEFAULT_EX = {
  chest:[["Doorway pec stretch","Gently press chest forward in doorway",1,30,"time","",""],["Wall push-up","Controlled push-ups against a stable wall",2,10,"reps","",""]],
  deltoid:[["Pendulum swing","Arm circles with relaxed shoulder",2,20,"time","",""],["Band external rotation","External rotation with resistance band",2,12,"reps","",""]],
  biceps:[["Standing bicep stretch","Arm extended with palm facing outward",2,20,"time","",""],["Light band curl","Controlled bicep curl",2,12,"reps","",""]],
  triceps:[["Overhead tricep stretch","Elbow bent behind head stretch",2,20,"time","",""],["Band tricep pushdown","Pushing band downwards",2,12,"reps","",""]],
  abs:[["Dead bug","Opposite arm and leg extension",2,10,"reps","",""],["Front plank","Core stability hold",3,20,"time","",""]],
  obliques:[["Side plank","Lateral core stability hold",2,15,"time","",""]],
  lats:[["Child's pose","Extended arms forward stretch",1,30,"time","",""],["Band lat pulldown","Pulling band down to chest",2,12,"reps","",""]],
  lowerback:[["Knee-to-chest stretch","Pulling knees toward chest while lying down",2,20,"time","",""]],
  glutes:[["Glute bridge","Lifting hips upward squeezing glutes",3,12,"reps","",""]],
  quads:[["Wall sit","Isometric wall squat hold",2,20,"time","",""],["Bodyweight squat","Controlled squat movement",2,10,"reps","",""]],
  hamstrings:[["Standing hamstring stretch","Hinged forward bend stretch",2,20,"time","",""]],
  calves:[["Wall calf stretch","Lean against wall with straight back leg",2,20,"time","",""],["Standing calf raise","Raising heels up",3,15,"reps","",""]],
  forearms:[["Wrist flexor stretch","Pulling fingers back gently",2,15,"time","",""]],
  neck:[["Neck side stretch","Ear to shoulder gentle tilt",2,15,"time","",""]]
};

const rehabState = {
  view: "front",
  selectedMg: null,
  searchQuery: "",
  exercises: JSON.parse(localStorage.getItem("rb_exercises") || "null") || JSON.parse(JSON.stringify(DEFAULT_EX)),
  checked: {},
  workout: JSON.parse(localStorage.getItem("rb_workout") || "[]"),
  saved: JSON.parse(localStorage.getItem("rb_saved") || "{}"),
  schedule: JSON.parse(localStorage.getItem("rb_schedule") || "{}")
};

function persistRehab() {
  try {
    localStorage.setItem("rb_exercises", JSON.stringify(rehabState.exercises));
    localStorage.setItem("rb_workout", JSON.stringify(rehabState.workout));
    localStorage.setItem("rb_saved", JSON.stringify(rehabState.saved));
    localStorage.setItem("rb_schedule", JSON.stringify(rehabState.schedule));
  } catch(e) {
    console.warn("LocalStorage save failed:", e);
  }
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.toggle('collapsed');
}

function getOverlaySVG(view) {
  if (view === "front") {
    return `
    <svg class="pixel-overlay-svg" viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg">
      <path class="muscle" data-mg="neck" d="M132,60 L168,60 L172,82 L128,82 Z" />
      <path class="muscle" data-mg="deltoid" d="M98,82 L130,87 L124,128 L84,112 Z" />
      <path class="muscle" data-mg="deltoid" d="M202,82 L170,87 L176,128 L216,112 Z" />
      <path class="muscle" data-mg="chest" d="M128,87 L150,90 L150,145 L118,138 L122,105 Z" />
      <path class="muscle" data-mg="chest" d="M172,87 L150,90 L150,145 L182,138 L178,105 Z" />
      <path class="muscle" data-mg="biceps" d="M78,114 L100,120 L92,168 L72,160 Z" />
      <path class="muscle" data-mg="biceps" d="M222,114 L200,120 L208,168 L228,160 Z" />
      <path class="muscle" data-mg="forearms" d="M68,172 L90,180 L84,232 L62,218 Z" />
      <path class="muscle" data-mg="forearms" d="M232,172 L210,180 L216,232 L238,218 Z" />
      <path class="muscle" data-mg="abs" d="M128,148 L172,148 L168,235 L132,235 Z" />
      <path class="muscle" data-mg="obliques" d="M112,148 L124,148 L128,235 L106,218 Z" />
      <path class="muscle" data-mg="obliques" d="M188,148 L176,148 L172,235 L194,218 Z" />
      <path class="muscle" data-mg="quads" d="M104,245 L144,245 L138,365 L108,358 Z" />
      <path class="muscle" data-mg="quads" d="M196,245 L156,245 L162,365 L192,358 Z" />
      <path class="muscle" data-mg="calves" d="M106,370 L136,370 L130,490 L110,480 Z" transform="translate(0, -110)" />
      <path class="muscle" data-mg="calves" d="M194,370 L164,370 L170,490 L190,480 Z" transform="translate(0, -110)" />
    </svg>`;
  } else {
    return `
    <svg class="pixel-overlay-svg" viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg">
      <path class="muscle" data-mg="neck" d="M132,60 L168,60 L172,82 L128,82 Z" />
      <path class="muscle" data-mg="deltoid" d="M98,82 L130,87 L124,128 L84,112 Z" />
      <path class="muscle" data-mg="deltoid" d="M202,82 L170,87 L176,128 L216,112 Z" />
      <path class="muscle" data-mg="lats" d="M124,87 L176,87 L182,175 L118,175 Z" />
      <path class="muscle" data-mg="triceps" d="M78,114 L100,120 L92,168 L72,160 Z" />
      <path class="muscle" data-mg="triceps" d="M222,114 L200,120 L208,168 L228,160 Z" />
      <path class="muscle" data-mg="lowerback" d="M120,178 L180,178 L174,235 L126,235 Z" />
      <path class="muscle" data-mg="glutes" d="M106,240 L194,240 L188,305 L112,305 Z" />
      <path class="muscle" data-mg="hamstrings" d="M108,310 L142,310 L136,375 L112,368 Z" />
      <path class="muscle" data-mg="hamstrings" d="M192,310 L158,310 L164,375 L188,368 Z" />
      <path class="muscle" data-mg="calves" d="M106,370 L136,370 L130,490 L110,480 Z" transform="translate(0, -110)" />
      <path class="muscle" data-mg="calves" d="M194,370 L164,370 L170,490 L190,480 Z" transform="translate(0, -110)" />
    </svg>`;
  }
}

function renderCharacterView() {
  const img = document.getElementById("charImageView");
  const overlayWrap = document.getElementById("svgOverlayWrap");
  const hint = document.getElementById("activeZoneHint");
  
  if (!img || !overlayWrap) return;

  if (rehabState.view === "front") {
    img.src = "watermarked_img_11394652652541726484.jpg";
    img.alt = "Anterior Pixel Muscle View";
  } else {
    img.src = "";
    img.alt = "Posterior Pixel Muscle View";
  }

  overlayWrap.innerHTML = getOverlaySVG(rehabState.view);

  overlayWrap.querySelectorAll(".muscle").forEach(el => {
    const mgId = el.dataset.mg;
    el.addEventListener("click", () => selectMuscle(mgId));
    if (mgId === rehabState.selectedMg) el.classList.add("selected");
  });

  if (hint) {
    if (rehabState.selectedMg) {
      const meta = MUSCLES.find(m => m.id === rehabState.selectedMg);
      hint.textContent = `▶ TARGET: ${meta ? meta.label.toUpperCase() : ''} ◀`;
      hint.style.color = "var(--accent-coral)";
    } else {
      hint.textContent = "▶ CLICK MUSCLE OR LEGEND ◀";
      hint.style.color = "var(--primary-cyan)";
    }
  }

  document.getElementById("btnFront")?.classList.toggle("active", rehabState.view === "front");
  document.getElementById("btnBack")?.classList.toggle("active", rehabState.view === "back");
}

function renderLegend() {
  const wrap = document.getElementById("legend");
  if (!wrap) return;
  wrap.innerHTML = "";
  MUSCLES.filter(m => m.views.includes(rehabState.view)).forEach(m => {
    const b = document.createElement("button");
    b.textContent = m.label;
    if (m.id === rehabState.selectedMg) b.classList.add("active");
    b.onclick = () => selectMuscle(m.id);
    wrap.appendChild(b);
  });
}

function populateCustomMgSelect() {
  const customMgSelect = document.getElementById("customMg");
  if (!customMgSelect || customMgSelect.options.length > 0) return;
  MUSCLES.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    customMgSelect.appendChild(opt);
  });
}

function selectMuscle(id) {
  rehabState.selectedMg = id;
  rehabState.checked[id] = rehabState.checked[id] || new Set();
  const searchInput = document.getElementById("globalSearch");
  if (searchInput) searchInput.value = "";
  rehabState.searchQuery = "";
  renderCharacterView();
  renderLegend();
  renderPicker();
}

function handleGlobalSearch(val) {
  rehabState.searchQuery = val.trim().toLowerCase();
  rehabState.selectedMg = null;
  renderCharacterView();
  renderLegend();
  renderPicker();
}

function estMinutesArray(ex) {
  if (ex[7]) return parseFloat(ex[7]);
  const sets = ex[2] || 1;
  const val = ex[3] || 10;
  const mode = ex[4] || "reps";
  if (mode === "time") return (val * sets) / 60;
  return ((val * 2.5 * sets) + (sets - 1) * 20) / 60;
}

function estMinutesObj(ex) {
  if (ex.manualTime) return parseFloat(ex.manualTime);
  if (ex.mode === "time") return (ex.val * ex.sets) / 60;
  return ((ex.val * 2.5 * ex.sets) + (ex.sets - 1) * 20) / 60;
}

function renderPicker() {
  const mg = rehabState.selectedMg;
  const query = rehabState.searchQuery;
  const addBtn = document.getElementById("addToWorkoutBtn");
  if (addBtn) addBtn.disabled = !mg && !query;
  
  const list = document.getElementById("exList");
  if (!list) return;
  list.innerHTML = "";

  let itemsToDisplay = [];
  if (query) {
    const mgName = document.getElementById("mgName");
    const mgHint = document.getElementById("mgHint");
    if (mgName) mgName.textContent = `Search results for "${query}"`;
    if (mgHint) mgHint.textContent = "Select from matching exercises";
    for (const [mId, exArr] of Object.entries(rehabState.exercises)) {
      exArr.forEach((ex, idx) => {
        const name = ex[0] || "";
        const desc = ex[1] || "";
        if (name.toLowerCase().includes(query) || desc.toLowerCase().includes(query)) {
          itemsToDisplay.push({ mgId: mId, idx, ex });
        }
      });
    }
  } else if (mg) {
    const meta = MUSCLES.find(m => m.id === mg);
    const mgName = document.getElementById("mgName");
    const mgHint = document.getElementById("mgHint");
    if (mgName) mgName.textContent = meta ? meta.label : mg;
    if (mgHint) mgHint.textContent = "Check exercises to add";
    rehabState.checked[mg] = rehabState.checked[mg] || new Set();
    (rehabState.exercises[mg] || []).forEach((ex, idx) => {
      itemsToDisplay.push({ mgId: mg, idx, ex });
    });
  } else {
    const mgName = document.getElementById("mgName");
    const mgHint = document.getElementById("mgHint");
    if (mgName) mgName.textContent = "Select a muscle group or search";
    if (mgHint) mgHint.textContent = "";
    return;
  }

  if (itemsToDisplay.length === 0) {
    list.innerHTML = '<p class="empty">No exercises found.</p>';
    return;
  }

  itemsToDisplay.forEach(item => {
    const { mgId, idx, ex } = item;
    const [name, desc, sets, val, mode, yt, imgData] = ex;
    const checkedSet = rehabState.checked[mgId] = rehabState.checked[mgId] || new Set();
    const isChecked = checkedSet.has(idx);

    const row = document.createElement("div");
    row.className = "exRow";
    row.innerHTML = `
      <input type="checkbox" ${isChecked ? "checked" : ""}>
      <div class="exInfo">
        <div class="exName">${name}</div>
        <div class="exDesc">${desc}</div>
        <div class="exLinks">
          ${yt ? `<a href="${yt}" target="_blank">📺 Watch YouTube</a>` : ""}
          ${imgData ? `<a href="${imgData}" target="_blank">🖼️ View Instruction</a>` : ""}
        </div>
        <div class="exMeta">
          <input type="number" min="1" value="${sets}" data-f="sets"> sets ×
          <input type="number" min="1" value="${val}" data-f="val"> ${mode === "time" ? "sec" : "reps"}
          <span style="margin-left:auto; font-size:11px; color:var(--primary-cyan);">~${estMinutesArray(ex).toFixed(1)}m</span>
        </div>
      </div>
      <button class="rmBtn" title="Remove">✕</button>`;

    row.querySelector('input[type=checkbox]').onchange = e => {
      if (e.target.checked) checkedSet.add(idx); else checkedSet.delete(idx);
    };
    row.querySelectorAll('input[type=number]').forEach(inp => {
      inp.onchange = () => {
        const f = inp.dataset.f;
        const v = Math.max(1, parseInt(inp.value) || 1);
        if (f === "sets") rehabState.exercises[mgId][idx][2] = v;
        else rehabState.exercises[mgId][idx][3] = v;
        persistRehab();
        renderPicker();
      };
    });
    row.querySelector('.rmBtn').onclick = () => {
      rehabState.exercises[mgId].splice(idx, 1);
      checkedSet.delete(idx);
      persistRehab();
      renderPicker();
    };
    list.appendChild(row);
  });
}

function handleCustomExerciseAdd() {
  const name = document.getElementById("customName")?.value.trim();
  const desc = document.getElementById("customDesc")?.value.trim();
  const targetMg = document.getElementById("customMg")?.value;
  const timeStr = document.getElementById("customTime")?.value.trim();
  const yt = document.getElementById("customYoutube")?.value.trim();
  const fileInput = document.getElementById("customImgFile");

  if (!name) { 
    if (typeof showToast === 'function') showToast("Please enter a custom exercise name.");
    else alert("Please enter a custom exercise name."); 
    return; 
  }
  const manualTime = timeStr ? parseFloat(timeStr) : null;

  const finishAdd = (imgUrl = "") => {
    rehabState.exercises[targetMg] = rehabState.exercises[targetMg] || [];
    rehabState.exercises[targetMg].push([name, desc || "Custom rehabilitation movement", 2, 10, "reps", yt, imgUrl, manualTime]);
    if (document.getElementById("customName")) document.getElementById("customName").value = "";
    if (document.getElementById("customDesc")) document.getElementById("customDesc").value = "";
    if (document.getElementById("customTime")) document.getElementById("customTime").value = "";
    if (document.getElementById("customYoutube")) document.getElementById("customYoutube").value = "";
    if (document.getElementById("customImgFile")) document.getElementById("customImgFile").value = "";
    persistRehab();
    if (typeof showToast === 'function') showToast(`Added "${name}" to custom exercises!`);
    if (rehabState.selectedMg === targetMg) renderPicker(); else selectMuscle(targetMg);
  };

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = e => finishAdd(e.target.result);
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    finishAdd("");
  }
}

function handleAddToWorkout() {
  const mgList = rehabState.selectedMg ? [rehabState.selectedMg] : Object.keys(rehabState.exercises);
  let addedCount = 0;
  mgList.forEach(mgId => {
    const checkedSet = rehabState.checked[mgId];
    if (!checkedSet) return;
    const meta = MUSCLES.find(m => m.id === mgId) || { label: mgId };
    checkedSet.forEach(idx => {
      const ex = rehabState.exercises[mgId][idx];
      if (!ex) return;
      rehabState.workout.push({
        mg: meta.label,
        name: ex[0],
        sets: ex[2],
        val: ex[3],
        mode: ex[4],
        manualTime: ex[7]
      });
      addedCount++;
    });
    checkedSet.clear();
  });
  persistRehab();
  if (addedCount > 0 && typeof showToast === 'function') {
    showToast(`Added ${addedCount} exercise(s) to recovery routine!`);
  }
  renderPicker();
  renderWorkout();
}

let workoutSearchQuery = "";
function handleWorkoutSearch(val) {
  workoutSearchQuery = val.trim().toLowerCase();
  renderWorkout();
}

function renderWorkout() {
  const wrap = document.getElementById("workoutList");
  if (!wrap) return;
  wrap.innerHTML = "";
  const filtered = rehabState.workout.map((ex, i) => ({ex, i})).filter(item => 
    item.ex.name.toLowerCase().includes(workoutSearchQuery) || 
    item.ex.mg.toLowerCase().includes(workoutSearchQuery)
  );

  if (rehabState.workout.length === 0) {
    wrap.innerHTML = '<p class="empty">No exercises added yet. Select a muscle group or search above.</p>';
  } else if (filtered.length === 0) {
    wrap.innerHTML = '<p class="empty">No matches found in your active routine.</p>';
  } else {
    filtered.forEach(item => {
      const { ex, i } = item;
      const row = document.createElement("div");
      row.className = "wRow";
      const mins = estMinutesObj(ex);
      row.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
            <span class="wTag">${ex.mg}</span>
        </div>
        <span class="wName" style="margin-left:8px;">${ex.name}</span>
        <span class="wMeta">
          <input type="number" class="mini-input" min="1" value="${ex.sets}" data-idx="${i}" data-f="sets">s ×
          <input type="number" class="mini-input" min="1" value="${ex.val}" data-idx="${i}" data-f="val">${ex.mode === 'time'?'s':'r'}
          <br><span style="color:var(--primary-cyan); font-weight:600; display:block; margin-top:4px;">~${mins.toFixed(1)}m</span>
        </span>
        <button class="rmBtn" data-idx="${i}">✕</button>`;

      row.querySelectorAll('input').forEach(inp => {
        inp.onchange = () => {
          const idx = parseInt(inp.dataset.idx);
          const f = inp.dataset.f;
          const v = Math.max(1, parseInt(inp.value) || 1);
          rehabState.workout[idx][f] = v;
          persistRehab();
          renderWorkout();
        };
      });

      row.querySelector('.rmBtn').onclick = () => {
        rehabState.workout.splice(i, 1);
        persistRehab();
        renderWorkout();
      };
      wrap.appendChild(row);
    });
  }

  const totalMins = rehabState.workout.reduce((acc, ex) => acc + estMinutesObj(ex), 0);
  const totalTimeEl = document.getElementById("totalTime");
  if (totalTimeEl) totalTimeEl.textContent = `${totalMins.toFixed(1)} min total`;
}

function handleSaveWorkout() {
  const input = document.getElementById("workoutNameInput");
  const name = input ? input.value.trim() : "";
  if (!name) {
    if (typeof showToast === 'function') showToast("Please enter a routine name before saving.");
    else alert("Please enter a routine name before saving.");
    return;
  }
  if (rehabState.workout.length === 0) {
    if (typeof showToast === 'function') showToast("Cannot save an empty routine.");
    else alert("Cannot save an empty routine.");
    return;
  }

  rehabState.saved[name] = JSON.parse(JSON.stringify(rehabState.workout));
  persistRehab();
  if (input) input.value = "";
  if (typeof showToast === 'function') showToast(`Routine "${name}" saved!`);
  renderSchedule();
}

function renderSchedule() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekWrap = document.getElementById("week");
  const savedListWrap = document.getElementById("savedList");

  if (weekWrap) {
    weekWrap.innerHTML = "";
    days.forEach(day => {
      const dayCol = document.createElement("div");
      dayCol.className = "dayCol";
      
      const dayRoutines = rehabState.schedule[day] || [];
      const routineCheckboxes = Object.keys(rehabState.saved).map(rName => {
        const isChecked = dayRoutines.includes(rName);
        return `
          <label>
            <input type="checkbox" data-day="${day}" data-routine="${rName}" ${isChecked ? "checked" : ""}>
            <span>${rName}</span>
          </label>`;
      }).join("");

      dayCol.innerHTML = `
        <div class="dayName">${day}</div>
        <div class="dayRoutines">
          ${routineCheckboxes || '<span style="font-size:10px; color:var(--text-subtle);">No saved routines</span>'}
        </div>`;

      dayCol.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.onchange = (e) => {
          const d = e.target.dataset.day;
          const r = e.target.dataset.routine;
          rehabState.schedule[d] = rehabState.schedule[d] || [];
          if (e.target.checked) {
            if (!rehabState.schedule[d].includes(r)) rehabState.schedule[d].push(r);
          } else {
            rehabState.schedule[d] = rehabState.schedule[d].filter(x => x !== r);
          }
          persistRehab();
        };
      });

      weekWrap.appendChild(dayCol);
    });
  }

  if (savedListWrap) {
    savedListWrap.innerHTML = "";
    const savedNames = Object.keys(rehabState.saved);
    if (savedNames.length === 0) {
      savedListWrap.innerHTML = '<p class="empty">No saved routines yet. Build a routine above and click "Save Routine".</p>';
    } else {
      savedNames.forEach(rName => {
        const items = rehabState.saved[rName];
        const card = document.createElement("div");
        card.className = "savedRoutineCard";
        
        const itemsHtml = items.map(it => `
          <div class="savedExItem">
            <span><strong>${it.mg}</strong>: ${it.name}</span>
            <span>${it.sets}s × ${it.val}${it.mode==='time'?'s':'r'}</span>
          </div>
        `).join("");

        card.innerHTML = `
          <div class="savedRoutineHead">
            <span>📂 ${rName} (${items.length} items)</span>
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="loadBtn" style="background:var(--primary-cyan); color:#0a0f1d; border:none; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Load</button>
              <button class="deleteBtn" style="background:rgba(255,94,98,0.2); color:var(--accent-coral); border:none; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Delete</button>
            </div>
          </div>
          <div class="savedRoutineContent">
            ${itemsHtml}
          </div>`;

        card.querySelector('.savedRoutineHead').onclick = (e) => {
          if (e.target.tagName === 'BUTTON') return;
          card.classList.toggle('open');
        };

        card.querySelector('.loadBtn').onclick = () => {
          rehabState.workout = JSON.parse(JSON.stringify(rehabState.saved[rName]));
          persistRehab();
          if (typeof showToast === 'function') showToast(`Loaded "${rName}" into active routine!`);
          renderWorkout();
        };

        card.querySelector('.deleteBtn').onclick = () => {
          delete rehabState.saved[rName];
          Object.keys(rehabState.schedule).forEach(d => {
            rehabState.schedule[d] = rehabState.schedule[d].filter(x => x !== rName);
          });
          persistRehab();
          if (typeof showToast === 'function') showToast(`Deleted routine "${rName}"`);
          renderSchedule();
        };

        savedListWrap.appendChild(card);
      });
    }
  }
}

function initRehabUI() {
  populateCustomMgSelect();

  document.getElementById("btnFront")?.addEventListener("click", () => {
    rehabState.view = "front";
    renderCharacterView();
    renderLegend();
  });

  document.getElementById("btnBack")?.addEventListener("click", () => {
    rehabState.view = "back";
    renderCharacterView();
    renderLegend();
  });

  document.getElementById("addCustomExBtn")?.addEventListener("click", handleCustomExerciseAdd);
  document.getElementById("addToWorkoutBtn")?.addEventListener("click", handleAddToWorkout);
  document.getElementById("saveWorkoutBtn")?.addEventListener("click", handleSaveWorkout);

  renderCharacterView();
  renderLegend();
  renderPicker();
  renderWorkout();
  renderSchedule();
}

// Global Exports
window.renderCharacterView = renderCharacterView;
window.renderLegend = renderLegend;
window.renderPicker = renderPicker;
window.renderWorkout = renderWorkout;
window.renderSchedule = renderSchedule;
window.togglePanel = togglePanel;
window.handleGlobalSearch = handleGlobalSearch;
window.handleWorkoutSearch = handleWorkoutSearch;
window.selectMuscle = selectMuscle;
window.initRehabUI = initRehabUI;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRehabUI);
} else {
  initRehabUI();
}