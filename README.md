# ER Airway Assistant — Phase 1

A reference/workflow tool for RSI, failed airway, and cricothyrotomy. Built as a
Progressive Web App: vanilla HTML/CSS/JS, no build step, no external dependencies.

## Why hosting matters
Android's "Add to Home screen" install prompt and the offline service worker
**only activate over HTTPS** (or `localhost`). Opening `index.html` straight
from a phone's file browser will not enable install or offline mode — the UI
still works, but skip those two features.

## Fastest path to a real install (free, ~5 minutes)
1. Create a free GitHub account if you don't have one.
2. Create a new repository, upload this whole folder's contents to it.
3. Repo → Settings → Pages → Deploy from branch → `main` / root. GitHub gives
   you a URL like `https://yourname.github.io/repo-name/`.
4. Open that URL on your Android phone in Chrome → menu (⋮) → **Install app**.
5. Open it once while online so the service worker caches the app shell —
   after that it works with airplane mode on.

Netlify Drop (netlify.com/drop) works the same way if you'd rather drag-and-drop
the folder instead of using Git.

## File map
```
index.html          screens (dashboard, RSI, calculator, failed airway, cric, ventilator, calculators, reports, settings)
css/style.css        all styling — tokens at the top
js/data.js            *** edit here to change doses, checklist wording, timelines, ventilator presets ***
js/calculators.js     pure math (IBW, tube size/depth, LMA size, shock index, MAP, pressor rates)
js/storage.js         IndexedDB wrapper (settings + saved case reports)
js/voice.js           Web Speech API wrapper
js/rsi.js             the RSI workflow screen: timer, smart timeline, laryngoscopy attempt timer, checklists
js/app.js             routing + every other screen + install/service-worker wiring
manifest.json         installability metadata
service-worker.js     offline cache-first strategy — bump CACHE_NAME after any content edit
icons/                app icons (simple original geometric mark, no third-party assets)
```

## Updating content later
Almost everything clinical (doses, checklist text, timeline targets, ventilator
presets) lives in `js/data.js`. Change a number or a string there and it flows
through every screen that uses it — you shouldn't need to touch the HTML/CSS
for routine updates. After any edit, bump `CACHE_NAME` in `service-worker.js`
(e.g. `er-airway-v2`) so installed phones pick up the change next time they're online.

## Known limitations (Phase 1)
- No login / multi-user sync — case reports save locally to the device only.
- Pediatric dosing uses standard per-kg formulas and an age→weight estimate;
  always prefer a measured weight or Broselow tape when available.
- Voice guidance uses the phone's built-in text-to-speech voice/quality.
- This is a clinical reference and workflow timer — it does not replace
  institutional protocol, senior consultation, or clinical judgment.

## Suggested Phase 2 ideas
ACLS/PALS/ATLS modules, sepsis bundle, massive transfusion protocol, stroke
thrombolysis checklist, STEMI pathway, toxicology quick-reference, burn
resuscitation calculator, multi-device case sync.
