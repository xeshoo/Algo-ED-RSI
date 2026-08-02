# ER Airway Assistant — Phase 2

A reference/workflow tool for RSI, failed airway, and cricothyrotomy. Built as a
Progressive Web App: vanilla HTML/CSS/JS, no build step, no external dependencies.

## What's new in Phase 2
- **Branching preoxygenation** — Adequate/Inadequate decision with NIV / gentle BVM / delayed sequence intubation escalation options.
- **Scored LEMON assessment** — 0–5 score with a green/amber/red recommendation banner (standard RSI / senior review / awake airway strategy).
- **Mandatory equipment checklist** — challenge-response style; the app blocks NEXT until all 8 items are confirmed.
- **Drug cards** — every sedative/NMB now shows onset, duration, and "avoid in" contraindications alongside the calculated dose, both in the RSI flow and the standalone Drug Calculator.
- **Real timestamped event log** — every step change, drug given, laryngoscopy attempt, and confirmation checkbox is logged with a wall-clock time and elapsed time, and flows automatically into the generated report.
- **Interactive failed-airway decision tree** — walks Cannot Intubate → Can Oxygenate? → LMA / Cricothyrotomy as branching choices instead of a static list, and can hand off directly into the Cricothyrotomy module or back into RSI at the confirmation step.
- **Expanded ventilator presets** — added TBI, hyperkalemia arrest, and post-ROSC; every preset now shows mode, TV, RR, PEEP, FiO2, trigger, inspiratory flow, and I:E ratio.
- **Full documentation report** — indication, LEMON score, drugs with times, attempts, Cormack-Lehane grade, bougie use, tube size/depth, confirmation checklist, operator/assistant, complications, and the full timestamped event log.
- **Tube confirmation reordered** — waveform ETCO₂ is marked and displayed as the primary method, ahead of chest rise / auscultation / depth.
- Visual polish: screen/step fade transitions, button press feedback, a shake animation when a gated step is blocked, and a fixed overlay-hidden bug from Phase 1.

## Why hosting matters
Android's "Add to Home screen" install prompt and the offline service worker
**only activate over HTTPS** (or `localhost`). Opening `index.html` straight
from a phone's file browser will not enable install or offline mode — the UI
still works, but skip those two features.

## Updating your existing GitHub repo (Phase 1 → Phase 2)
Six files changed — everything else (icons, manifest.json, README) is untouched:
`index.html`, `css/style.css`, `js/data.js`, `js/rsi.js`, `js/app.js`, `service-worker.js`.

For each one: open it in your repo → pencil icon (edit) → select all existing
text → delete → paste in the new version from this package → commit.
`service-worker.js`'s cache name has been bumped to `er-airway-v4`, so once
you commit it, previously-installed phones will pull the new files next time
they're online — no separate cache-clear should be needed, but if anything
looks stale, repeat the Site settings → Clear & reset step from before.

## File map
```
index.html          screens (dashboard, RSI, calculator, failed airway, cric, ventilator, calculators, reports, settings)
css/style.css        all styling — tokens at the top
js/data.js            *** edit here to change doses, checklist wording, timelines, ventilator presets, LEMON scoring, failed-airway tree ***
js/calculators.js     pure math (IBW, tube size/depth, LMA size, shock index, MAP, pressor rates)
js/storage.js         IndexedDB wrapper (settings + saved case reports)
js/voice.js           Web Speech API wrapper
js/rsi.js             the RSI workflow screen: timer, smart timeline, gated checklists, branching preox, laryngoscopy timer, event log
js/app.js             routing + every other screen (drug calculator, failed-airway tree walker, ventilator, calculators, reports) + install/service-worker wiring
manifest.json         installability metadata
service-worker.js     offline cache-first strategy — bump CACHE_NAME after any content edit
icons/                app icons (simple original geometric mark, no third-party assets)
```

## Updating content later
Almost everything clinical (doses, checklist text, timeline targets, ventilator
presets, LEMON scoring bands, failed-airway tree) lives in `js/data.js`. Change
a number or a string there and it flows through every screen that uses it —
you shouldn't need to touch the HTML/CSS for routine updates. After any edit,
bump `CACHE_NAME` in `service-worker.js` (e.g. `er-airway-v5`) so installed
phones pick up the change next time they're online.

## Known limitations
- No login / multi-user sync — case reports save locally to the device only.
- Pediatric dosing uses standard per-kg formulas and an age→weight estimate;
  always prefer a measured weight or Broselow tape when available.
- Voice guidance uses the phone's built-in text-to-speech voice/quality.
- This is a clinical reference and workflow timer — it does not replace
  institutional protocol, senior consultation, or clinical judgment.

## Suggested Phase 3 ideas
CPR/peri-arrest integration during RSI, customizable protocols per hospital,
ACLS/PALS/ATLS modules, sepsis bundle, massive transfusion protocol, stroke
thrombolysis checklist, STEMI pathway, toxicology quick-reference, burn
resuscitation calculator, multi-device case sync, native icon set.

