// =====================================================================
// gemini-scan.js — faster, more reliable Gemini scanning
//
// LOAD THIS AFTER macro-tracker.js (see index.html instructions).
// It overrides: resizeImageForScan, callGeminiVision, handleImageScan,
// handleTextScan. Nothing else in macro-tracker.js needs to change.
//
// What it fixes:
//  - Thinking turned down (biggest speed win on Gemini 3.x Flash models)
//  - Per-request timeout so a hung model can't freeze the scan
//  - Last working model is tried first (and remembered across sessions)
//  - Auto-retry without thinkingConfig if a model rejects it (HTTP 400)
//  - JSON response mode + tolerant JSON parsing
//  - Smaller / EXIF-correct image upload
//  - Live elapsed-seconds counter in the status box
//  - API key sent in a header instead of the URL
// =====================================================================
(function () {
  'use strict';

  if (typeof callGeminiVision === 'undefined') {
    console.error('gemini-scan.js must be loaded AFTER macro-tracker.js');
    return;
  }

  // ---- Tunables -----------------------------------------------------
  // Fastest first. Swap the order if you prefer 3.8-flash accuracy.
  GEMINI_PREFERRED_MODEL = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  GEMINI_FALLBACK_MODELS = ['gemini-flash-lite-latest'];

  const TIMEOUT_MS = 15000;                 // per model attempt
  const THINKING_CONFIG = { thinkingLevel: 'low' };
  const SCAN_MAX_EDGE = 896;                // px, longest side
  const SCAN_JPEG_QUALITY = 0.7;
  const MODEL_STORAGE_KEY = 'apex_gemini_model';

  // Remember the last model that worked, across app restarts
  try {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved) cachedWorkingGeminiModel = saved;
  } catch (e) { /* storage unavailable */ }

  let statusModel = '';

  // ---- Helpers ------------------------------------------------------
  function geminiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
  }

  function parseJsonLoose(text) {
    const clean = String(text || '').replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      const s = clean.indexOf('{');
      const t = clean.lastIndexOf('}');
      if (s >= 0 && t > s) parsed = JSON.parse(clean.slice(s, t + 1));
      else throw new Error('not JSON');
    }
    if (Array.isArray(parsed)) parsed = parsed[0];
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    return parsed;
  }

  function buildPayload(parts) {
    return {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        thinkingConfig: THINKING_CONFIG
        // NOTE: no maxOutputTokens on purpose — thinking tokens count
        // toward it and a small cap can return empty/truncated JSON.
      }
    };
  }

  function startStatusTicker(verb) {
    const t0 = Date.now();
    const id = setInterval(() => {
      const el = document.getElementById('scan-status-text');
      if (!el || el.classList.contains('text-rose-300')) return;
      const secs = Math.round((Date.now() - t0) / 1000);
      el.textContent = `${verb} with ${statusModel || 'Gemini'}... ${secs}s`;
    }, 1000);
    return () => clearInterval(id);
  }

  // ---- Image resize (EXIF-aware, smaller) ---------------------------
  window.resizeImageForScan = async function resizeImageForScan(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      throw new Error('Could not decode the selected image file');
    }
    const scale = Math.min(1, SCAN_MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();
    const dataUrl = canvas.toDataURL('image/jpeg', SCAN_JPEG_QUALITY);
    return { base64Data: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  };

  // ---- Network ------------------------------------------------------
  async function geminiRequest(apiKey, modelId, payload) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
        {
          method: 'POST',
          signal: ctl.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        }
      );
    } finally {
      clearTimeout(timer);
    }
  }

  window.callGeminiVision = async function callGeminiVision(apiKey, payload) {
    // cached winner first, then preferred, then fallback (deduped)
    const candidates = [...new Set(
      [cachedWorkingGeminiModel, ...GEMINI_PREFERRED_MODEL, ...GEMINI_FALLBACK_MODELS].filter(Boolean)
    )];

    let lastError = null;

    for (const modelId of candidates) {
      statusModel = modelId;
      try {
        let res = await geminiRequest(apiKey, modelId, payload);

        // Model rejected thinkingConfig? Retry the same model without it.
        if (res.status === 400 && payload.generationConfig?.thinkingConfig) {
          const { thinkingConfig, ...gc } = payload.generationConfig;
          res = await geminiRequest(apiKey, modelId, { ...payload, generationConfig: gc });
        }

        if (res.ok) {
          cachedWorkingGeminiModel = modelId;
          try { localStorage.setItem(MODEL_STORAGE_KEY, modelId); } catch (e) {}
          return { modelId, data: await res.json() };
        }

        let detail = '';
        try { detail = (await res.json())?.error?.message || ''; } catch (e) {}
        lastError = new Error(`${modelId}: HTTP ${res.status}${detail ? ' – ' + detail : ''}`);

        // Bad / blocked key: other models won't help
        if (res.status === 401 || res.status === 403) break;
      } catch (err) {
        lastError = err.name === 'AbortError'
          ? new Error(`${modelId} timed out after ${TIMEOUT_MS / 1000}s`)
          : err;
      }
    }

    throw lastError || new Error('All Gemini models failed');
  };

  // ---- Image scan ---------------------------------------------------
  window.handleImageScan = async function handleImageScan(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      showToast('Please add your Gemini API key in Settings first!');
      switchTab('settings');
      input.value = '';
      return;
    }

    statusModel = cachedWorkingGeminiModel || GEMINI_PREFERRED_MODEL[0];
    setScanStatus('Preparing image...', false);
    const stopTicker = startStatusTicker('Analyzing');

    try {
      const { base64Data, mimeType } = await resizeImageForScan(file);

      const promptText =
        'Analyze this food image or nutritional label. Identify the food item and ' +
        'estimate/extract the nutrition facts per serving: food name, calories (kcal), ' +
        'protein (g), carbs (g), fat (g). Return ONLY a JSON object with keys: ' +
        'name (string), cal (number), p (number), c (number), f (number).';

      const payload = buildPayload([
        { text: promptText },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]);

      const { modelId, data } = await callGeminiVision(apiKey, payload);

      let parsed;
      try {
        parsed = parseJsonLoose(geminiText(data));
      } catch (err) {
        throw new Error(`${modelId} returned a response that could not be parsed as JSON`);
      }

      stopTicker();
      document.getElementById('scan-status')?.classList.add('hidden');

      openFormModal();
      document.getElementById('food-name-input').value = parsed.name || 'Scanned Food Item';
      document.getElementById('food-cal-input').value = Math.round(Number(parsed.cal) || 0);
      document.getElementById('food-p-input').value = Math.round((Number(parsed.p) || 0) * 10) / 10;
      document.getElementById('food-c-input').value = Math.round((Number(parsed.c) || 0) * 10) / 10;
      document.getElementById('food-f-input').value = Math.round((Number(parsed.f) || 0) * 10) / 10;

      showToast(`Image analyzed with ${modelId}! Verify values and save.`);
    } catch (err) {
      stopTicker();
      setScanStatus(`AI Scan failed: ${err.message || 'Unknown error'}`, true);
    } finally {
      stopTicker();
      input.value = ''; // lets you pick the same photo again
    }
  };

  // ---- Text scan ----------------------------------------------------
  window.handleTextScan = async function handleTextScan() {
    const inputEl = document.getElementById('food-text-input');
    const btn = document.getElementById('text-scan-btn');
    const query = (inputEl?.value || '').trim();

    if (!query) {
      showToast('Type a food or meal description first');
      inputEl?.focus();
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      showToast('Please add your Gemini API key in Settings first!');
      switchTab('settings');
      return;
    }

    if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }
    statusModel = cachedWorkingGeminiModel || GEMINI_PREFERRED_MODEL[0];
    setScanStatus('Searching macros...', false);
    const stopTicker = startStatusTicker('Searching macros');

    try {
      const promptText =
        `Estimate the nutrition facts for this food or meal description: "${query}". ` +
        `If quantities are given (e.g. "2 eggs"), return the TOTAL for everything described; ` +
        `if no quantity is given, assume one typical serving. ` +
        `Return ONLY a JSON object with keys: name (short descriptive string including the quantity), ` +
        `cal (number, kcal), p (number, grams protein), c (number, grams carbs), f (number, grams fat).`;

      const payload = buildPayload([{ text: promptText }]);
      const { modelId, data } = await callGeminiVision(apiKey, payload);

      let parsed;
      try {
        parsed = parseJsonLoose(geminiText(data));
      } catch (err) {
        throw new Error(`${modelId} returned a response that could not be parsed as JSON`);
      }

      stopTicker();
      document.getElementById('scan-status')?.classList.add('hidden');

      openFormModal();
      document.getElementById('food-name-input').value = parsed.name || query;
      document.getElementById('food-cal-input').value = Math.round(Number(parsed.cal) || 0);
      document.getElementById('food-p-input').value = Math.round((Number(parsed.p) || 0) * 10) / 10;
      document.getElementById('food-c-input').value = Math.round((Number(parsed.c) || 0) * 10) / 10;
      document.getElementById('food-f-input').value = Math.round((Number(parsed.f) || 0) * 10) / 10;

      if (inputEl) inputEl.value = '';
      showToast(`Macros estimated with ${modelId}! Verify values and save.`);
    } catch (err) {
      stopTicker();
      setScanStatus(`AI Search failed: ${err.message || 'Unknown error'}`, true);
    } finally {
      stopTicker();
      if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
    }
  };
})();
