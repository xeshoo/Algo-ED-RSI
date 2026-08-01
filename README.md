# ER Airway Assistant — Phase 2

A comprehensive reference/workflow tool for RSI, failed airway, and cricothyrotomy.  
Built as a Progressive Web App: vanilla HTML/CSS/JS, no build step, no external dependencies.

## What's New in Phase 2

### 1. Dynamic Decision-Tree RSI Workflow
The RSI workflow is no longer linear. It branches based on patient condition:
- **Pre-oxygenation decision point**: Adequate → continue, Inadequate → NIV / BVM / DSI branches
- Each branch records the decision and continues appropriately
- Pediatric pathway with age-specific considerations

### 2. Interactive LEMON Scoring
- Full LEMON assessment with checkboxes for all criteria
- **Automatic score calculation** with color-coded risk display:
  - 🟢 **0–1**: Low risk — Standard RSI
  - 🟡 **2–3**: Moderate risk — Senior review, consider video laryngoscopy
  - 🔴 **4+**: High risk — Awake airway strategy, surgical standby

### 3. Enhanced Drug Calculator
Each drug now shows:
- **Calculated dose** based on weight
- **Onset** and **duration**
- **Route** of administration
- **Contraindications** (highlighted warnings)
- **Special warnings** and clinical pearls
- Elderly dose reduction automatically applied (25% reduction)

### 4. Real-Time Timestamp Logging
Every significant event is automatically timestamped:
- Checklist completion, drug administration, decision points
- Laryngoscopy attempts with duration tracking
- Tube confirmation steps, emergency declarations
- Displays elapsed time (from RSI start) and wall-clock time

### 5. Interactive Failed Airway Algorithm
Decision-tree flow for Cannot Intubate → Can Oxygenate? → SGA vs CICO with equipment checklists and step-by-step cricothyrotomy procedure.

### 6. Evidence-Based Ventilator Presets
8 condition-specific presets (ARDS, Asthma, COPD, TBI, Pulmonary Edema, DKA, Post-ROSC, Hyperkalemia Arrest) each with complete settings and clinical notes.

### 7. Comprehensive Procedure Report
Auto-generated report with: indication, LEMON score, drugs, timeline, attempts, Cormack-Lehane grade, tube details, ETCO₂ confirmation, complications, operator, assistant, ventilator settings. Save, copy, or print/PDF.

### 8. Mandatory Airway Checklist (Challenge-Response)
10-item checklist that gates progression — all items must be checked before the RSI timer starts.

### 9. ETCO₂-First Tube Confirmation
Confirmation hierarchy follows current guidelines with waveform ETCO₂ as gold standard.

### 10. Premium Visual Design
Modern dark theme, smooth animations, color-coded risk indicators, responsive design, PWA installable with offline support.

## File Map
```
index.html              All screens with branching RSI, interactive failed airway, ventilator presets
css/style.css           Design system with tokens, animations, color-coded components
js/data.js              *** Clinical data hub — edit here for doses, presets, checklists ***
js/calculators.js       Pure math: IBW, tube size, LEMON scoring, shock index, pressor rates
js/storage.js           IndexedDB wrapper (settings + saved case reports)
js/voice.js             Web Speech API wrapper
js/rsi.js               RSI workflow engine: branching logic, checklist gate, timestamps, attempts
js/app.js               Routing, failed airway flow, ventilator presets, report generation
manifest.json           Installability metadata
service-worker.js       Offline cache-first strategy (bump CACHE_NAME after edits)
icons/                  App icons
```

## Updating Content
Almost everything clinical (doses, checklist text, ventilator presets, drug info) lives in `js/data.js`. Change a value there and it flows through every screen. After any edit, bump `CACHE_NAME` in `service-worker.js`.

## Hosting
Requires HTTPS for install prompt and offline mode. Deploy via:
1. **GitHub Pages**: Push to repo → Settings → Pages → Deploy from `main`
2. **Netlify Drop**: Drag-and-drop the folder at netlify.com/drop

## Known Limitations
- No login / multi-user sync — case reports save locally only
- Pediatric dosing uses standard per-kg formulas; prefer measured weight or Broselow
- Voice guidance uses built-in TTS voice quality
- Clinical reference and workflow timer — does not replace institutional protocol

## Phase 3 Ideas
- ACLS/PALS/ATLS modules
- Sepsis bundle / massive transfusion protocol
- Stroke thrombolysis checklist / STEMI pathway
- Toxicology quick-reference / burn resuscitation calculator
- Multi-device case sync
- Customizable protocols for local hospital practice
- CPR integration for peri-arrest intubations
