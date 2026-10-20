# 🐱 Nyanletics Hybrid Training

> **"Stay Paw-sitive. Lift Heavy. Run Wild. Recover Fur-iously."**

Nyanletics Hybrid Training is a Progressive Web Application (PWA) built for hybrid athletes. It combines a heavy lifting log, an interactive plate and sled loader, a Gemini AI-powered macro tracker, an anatomical rehab/recovery map, a running calculator, and a full-featured multi-mode timer suite

---

## ✨ Features & Modules

### 1. 🏋️‍♂️ Lifting Log (`lifting-log.js`)
* **Set Logging:** Track sets, weights, reps, tempo, and date for bodyweight or weighted movements
* **Theoretical 1RM:** Automatically estimates 1RM across key compounds using the Epley formula
* **Weight Suggestions:** Recommends working targets based on your top recorded sets, target reps, and tempo
* **Plate Loader Coupling:** Send suggested working weights directly into the plate loader calculator

### 2. 🛷 Plate & Sled Loader (`plate-loader.js`)
* **Barbell & Sled Visualizers:** Interactive SVG graphics that display plates loaded onto a barbell or a HYROX training sled
* **Inventory Management:** Tracks individual plate quantities (kg and lb) and allows customization of default stock
* **HYROX Presets:** Quick-load buttons for standard Open and Pro sled push/pull weights

### 3. 🥗 Macro Tracker AI (`macro-tracker.js`)
* **Daily Macro Dashboard:** Tracks calories, protein, carbs, and fat against custom daily goals with progress bars
* **Gemini AI Vision & Text Scans:** Analyze food photos, nutritional labels, or text descriptions to instantly estimate and log nutrition facts
* **Favourite Foods:** Save frequent meals with portion scaling for fast logging

### 4. 🩹 Rehab & Recovery (`rehab.js`)
* **Interactive Body Map:** Front and back anatomical SVGs allowing you to select specific muscle groups or joints for targeted mobility ideas
* **Custom Workout Builder:** Create time-budgeted rehab routines from an editable exercise library with photo, video, and set/rep configurations
* **Weekly Schedule:** Assign saved routines to days of the week

### 5. 🏃 Running Pace & Workout Estimator (`running.js`)
* **Precision Pace Calculator:** Lock distance, time, or pace/speed to compute running metrics without drift
* **AI Workout Estimator:** Paste complex running workouts to get distance and time breakdowns via Gemini AI (with an offline regex fallback)

### 6. ⏱️ Timer Suite (`timer.js`)
* **Stopwatch:** Rolling stopwatch supporting up to 40 active splits
* **Countdown Timer:** Configurable countdown with audio cues
* **Interval Timers:** Simple and customizable multi-block interval sequences (up to 40 steps) with a get-ready countdown, audio beeps, and an independent metronome

### 7. 🗂️ CSV/ZIP Data Portability (`csv-io.js`)
* Export and import lifting logs, food logs, and rehab schedules/routines as CSV files
* Rehab exports support bundling exercise reference photos into a `.zip` archive

---

## 🛠️ Project Architecture

```text
├── index.html            # Main application shell and layout
├── core.js               # Global app shell, tab routing, and PWA bootstrap[cite: 10]
├── lifting-log.js        # Lifting log & 1RM calculator module[cite: 1]
├── plate-loader.js       # Barbell/sled visualizer & inventory[cite: 3]
├── macro-tracker.js      # Daily macro logs, favourites & Gemini vision[cite: 2]
├── rehab.js              # Anatomical body map & rehab routine builder[cite: 4]
├── running.js            # Running pace calculator & workout estimator[cite: 5]
├── timer.js              # Stopwatch, countdown & interval timers[cite: 7]
├── csv-io.js             # CSV import/export & ZIP handlers[cite: 9]
├── sw.js                 # Service worker for offline caching & PWA support[cite: 6]
├── manifest.json         # PWA app manifest
└── theme.css / *.css     # Styling assets

## 🚀 Getting Started

* **Host Locally:** Because the application utilizes Service Workers (`sw.js`) and module imports, serve the directory through a local web server (e.g., Python `http.server` or Node `http-server`). Opening files directly via `file://` may restrict service worker registration.
* **Download all files and unzip. Navigate to folder and run index.html.
* **Configure API Key:** To use the Gemini AI features in the Macro Tracker and Running tab, go to the **Settings** tab and input your Google Gemini API key.
* **Install as PWA:** On supported devices/browsers, use the install prompt or your browser menu to add Nyanletics to your home screen for offline use.
