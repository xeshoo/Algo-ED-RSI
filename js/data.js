/* ==========================================================================
   DATA.JS — all clinical content lives here.
   To update a dose, checklist item, or timeline, edit this file only.
   Nothing in here talks to the DOM; app.js / rsi.js render it.
   ========================================================================== */

const CATEGORIES = {
  adult:   { label: "Adult",        note: "Standard adult RSI dosing." },
  child:   { label: "Pediatric",    note: "Weight-based dosing — confirm with Broselow tape if available." },
  pregnant:{ label: "Pregnant",     note: "Left lateral tilt 15°, pre-oxygenate longer, expect faster desaturation, avoid prolonged apnea." },
  shock:   { label: "Shock / hemodynamically unstable", note: "Reduce induction doses ~50%. Prefer ketamine. Have push-dose pressor ready." },
  asthma:  { label: "Severe asthma / bronchospasm", note: "Ketamine preferred (bronchodilator). Permissive hypercapnia post-intubation." },
  head:    { label: "Head injury / raised ICP", note: "Avoid hypotension and hypoxia. Consider lidocaine pretreatment. Etomidate or ketamine both reasonable." }
};

/* ---- Sedative / induction agents (dose = mg/kg unless noted) ---- */
const SEDATIVES = [
  { id:"ketamine",  name:"Ketamine",  dose:2,    unit:"mg/kg IV", onset:"~30s", duration:"10–15 min",
    note:"Preferred in shock, asthma, hemodynamic instability.", bestFor:["shock","asthma","head"],
    avoid:["Uncontrolled hypertension","Aortic dissection","Severe ischemic heart disease","Known psychosis (relative)"] },
  { id:"midazolam", name:"Midazolam", dose:0.175, range:"0.15–0.2", unit:"mg/kg IV", onset:"60–90s", duration:"15–30 min",
    note:"Reduce dose in elderly / critically ill.", avoid:["Hemodynamic instability (causes hypotension)"] },
  { id:"etomidate", name:"Etomidate", dose:0.3,  unit:"mg/kg IV", onset:"15–45s", duration:"3–12 min",
    note:"Hemodynamically neutral; avoid in septic shock (adrenal suppression) if alternatives exist.", bestFor:["head"],
    avoid:["Septic shock / adrenal insufficiency (relative)"] },
  { id:"propofol",  name:"Propofol",  dose:1.5,  range:"1–2.5", unit:"mg/kg IV", onset:"15–45s", duration:"5–10 min",
    note:"Causes hypotension — use cautiously in shock.", avoid:["Hemodynamic instability","Egg/soy allergy (formulation-dependent)"] }
];

/* ---- Neuromuscular blockers ---- */
const NMB = [
  { id:"sux", name:"Succinylcholine", dose:1.5, unit:"mg/kg IV (adult)", pedDose:2, pedUnit:"mg/kg IV (infant)", onset:"45–60s", duration:"6–10 min",
    avoid:["Hyperkalaemia (e.g. renal failure)","Organophosphate poisoning","Delayed severe burns (>24h)","Prolonged crush injury","Personal/family history of malignant hyperthermia","Neuromuscular disease (denervation, myopathy)"] },
  { id:"roc", name:"Rocuronium", dose:1.2, unit:"mg/kg IV", onset:"~60s", duration:"20–35 min",
    note:"Preferred nondepolarizer for ED RSI; reversible with sugammadex.", avoid:["Known rocuronium/NMB anaphylaxis"] }
];

/* ---- Post-intubation sedation / analgesia infusions (per kg per hour) ---- */
const SEDATION_INFUSIONS = [
  { id:"morphine",  name:"Morphine",       dose:0.25,  range:"0.1–0.4",  unit:"mg/kg/hr" },
  { id:"ketamine2", name:"Ketamine",       dose:0.225, range:"0.05–0.4", unit:"mg/kg/hr" },
  { id:"midazolam2",name:"Midazolam",      dose:0.06,  range:"0.02–0.1", unit:"mg/kg/hr" },
  { id:"dex",       name:"Dexmedetomidine",dose:0.45,  range:"0.2–0.7",  unit:"µg/kg/hr" },
  { id:"propofol2", name:"Propofol",       dose:50,    range:"25–75",    unit:"µg/kg/min" },
  { id:"fentanyl",  name:"Fentanyl",       dose:1.25,  range:"0.5–2",    unit:"µg/kg/hr" }
];

/* ---- Vasopressor infusion starting rates (mcg/kg/min unless noted) ---- */
const VASOPRESSORS = [
  { id:"norepi",  name:"Norepinephrine", dose:0.05, range:"0.01–3",  unit:"µg/kg/min" },
  { id:"epi",     name:"Epinephrine",    dose:0.05, range:"0.01–1",  unit:"µg/kg/min" },
  { id:"pheno",   name:"Phenylephrine",  dose:0.5,  range:"0.1–5",   unit:"µg/kg/min" },
  { id:"vaso",    name:"Vasopressin",    dose:0.04, range:"0.01–0.1",unit:"units/min", fixed:true }
];

/* ---- Ideal RSI timeline (seconds from case start) — used for the smart timeline ---- */
const IDEAL_TIMELINE = [
  { t:0,   label:"Start" },
  { t:30,  label:"LEMON assessment" },
  { t:90,  label:"Equipment check" },
  { t:270, label:"Oxygenation complete" },
  { t:300, label:"Induction" },
  { t:315, label:"Paralytic" },
  { t:375, label:"Laryngoscopy" },
  { t:405, label:"ET tube placed" },
  { t:420, label:"ETCO₂ confirmed" },
  { t:450, label:"Tube secured" }
];

/* ---- RSI workflow steps (drive the main step screen + progress bar) ----
   "gate:true" means the app will not allow NEXT until the step's completion
   condition is met (see rsi.js isStepComplete). ---- */
const RSI_STEPS = [
  { id:"lemon",    label:"Airway assessment (LEMON)", voice:"Assess for a difficult airway.", gate:false },
  { id:"equip",    label:"Equipment check",           voice:"Check your airway equipment before proceeding.", gate:true },
  { id:"preox",    label:"Preoxygenation",            voice:"Begin preoxygenation.", gate:false },
  { id:"position", label:"Position",                  voice:"Position the patient.", gate:false },
  { id:"induction",label:"Induction",                 voice:"Administer induction drug.", gate:false },
  { id:"paralytic",label:"Paralytic",                 voice:"Administer paralytic.", gate:false },
  { id:"waiting",  label:"Waiting for paralysis",      voice:"Waiting for paralysis.", gate:false },
  { id:"laryngoscopy",label:"Laryngoscopy",           voice:"Laryngoscopy now.", gate:false },
  { id:"confirm",  label:"Confirm tube placement",     voice:"Confirm waveform capnography.", gate:true },
  { id:"secure",   label:"Secure & document",          voice:"Secure the tube and document.", gate:false }
];

/* ---- LEMON — scored, 1 point each, drives a traffic-light recommendation ---- */
const LEMON_ITEMS = [
  "Look — external markers of difficult airway (facial trauma, large incisors, beard, large tongue)",
  "Evaluate 3-3-2 — mouth opening <3 fingers, hyoid-chin <3 fingers, thyroid-hyoid <2 fingers",
  "Mallampati score ≥ 3",
  "Obstruction / obesity",
  "Neck mobility reduced"
];
function lemonRecommendation(score){
  if(score <= 1) return { tier:"green",  label:"Standard RSI",        text:"Low predicted difficulty. Proceed with standard RSI plan." };
  if(score <= 3) return { tier:"amber",  label:"Senior review",       text:"Moderate difficulty predicted. Call for a senior/experienced airway operator before proceeding if time allows." };
  return              { tier:"red",    label:"Awake airway strategy", text:"High difficulty predicted. Strongly consider an awake technique, video laryngoscopy, and having a surgical airway operator/kit immediately available." };
}

/* ---- Mandatory challenge-response equipment checklist (gates progression) ---- */
const EQUIPMENT_CHECKLIST = [
  "Monitor — ECG, SpO2, BP", "Suction", "Oxygen source & delivery device", "Bougie",
  "Cric kit", "Drugs drawn up & labelled", "Capnography", "Assistant present"
];

/* ---- Tube confirmation checklist — order reflects priority (capnography primary) ---- */
const CONFIRMATION_CHECKLIST = [
  { label:"Waveform ETCO₂ present (35–45mmHg)", primary:true },
  { label:"Bilateral chest rise" },
  { label:"Bilateral breath sounds on auscultation" },
  { label:"No epigastric / gastric insufflation sounds" },
  { label:"Tube secured at correct depth" }
];

/* ---- Failed airway — branching decision tree ----
   Each node: id, label, detail, and either `next` (single) or `branch` (choices).
   app.js walks this as a state machine instead of a flat list. ---- */
const FAILED_AIRWAY_TREE = {
  start: "cannotIntubate",
  nodes: {
    cannotIntubate: {
      label: "Cannot intubate",
      detail: "First laryngoscopy attempt unsuccessful or predicted to fail.",
      branch: [
        { label:"Optimize & re-attempt (bougie / different blade)", to:"reattempt" },
        { label:"Can't oxygenate — go straight to escalation", to:"canOxygenate" }
      ]
    },
    reattempt: {
      label:"Attempt 2 (optimized)",
      detail:"Change position, blade, or operator. Use a bougie. Maximum 2 attempts by the same operator. Do not exceed 30s per attempt.",
      branch: [
        { label:"Successful", to:"success" },
        { label:"Still unsuccessful", to:"canOxygenate" }
      ]
    },
    canOxygenate: {
      label:"Can you oxygenate with BVM/LMA?",
      detail:"This is the critical decision point — it determines urgency of surgical airway.",
      branch:[
        { label:"YES — oxygenating adequately", to:"lma" },
        { label:"NO — cannot oxygenate", to:"cric" }
      ]
    },
    lma: {
      label:"Insert supraglottic airway (LMA)",
      detail:"Restores oxygenation while a definitive airway plan is made. Consider second-generation LMA if available. Re-attempt intubation through/alongside the LMA or proceed to OT for a controlled definitive airway.",
      branch:[
        { label:"Oxygenation adequate — plan definitive airway", to:"success" },
        { label:"Deteriorating / inadequate", to:"cric" }
      ]
    },
    cric: {
      label:"CANNOT INTUBATE, CANNOT OXYGENATE — Scalpel cricothyrotomy",
      detail:"Emergency surgical airway. Do not delay. Open the Cricothyrotomy module for the step-by-step guide.",
      critical:true,
      branch:[
        { label:"Open Cricothyrotomy guide", to:"cricguide" }
      ]
    },
    cricguide:{ label:"Cricothyrotomy", detail:"Proceeding to the guided cricothyrotomy module.", terminal:"cric" },
    success: { label:"Airway secured", detail:"Confirm with waveform capnography and proceed to post-intubation care.", terminal:"confirm" }
  }
};

/* ---- Cricothyrotomy steps ---- */
const CRIC_STEPS = [
  { id:"c1", label:"Identify cricothyroid membrane", detail:"Palpate between thyroid and cricoid cartilage in the midline." },
  { id:"c2", label:"Prep & stabilize", detail:"Stabilize larynx with non-dominant hand. Quick antiseptic prep if time allows." },
  { id:"c3", label:"Vertical skin incision", detail:"~3–4cm vertical incision through skin over the membrane." },
  { id:"c4", label:"Horizontal membrane incision", detail:"Stab incision through the cricothyroid membrane; rotate blade 90°." },
  { id:"c5", label:"Insert bougie / hook", detail:"Pass a bougie or tracheal hook through the incision, angled caudad." },
  { id:"c6", label:"Railroad tube", detail:"Pass a cuffed 6.0mm ET or cric tube over the bougie into the trachea." },
  { id:"c7", label:"Confirm & secure", detail:"Confirm with ETCO₂ and bilateral air entry, then secure the tube." }
];

/* ---- Ventilator presets — initial settings, adult 70kg reference unless noted ---- */
const VENT_PRESETS = {
  ards:      { label:"ARDS", mode:"Volume control (or pressure control)", tv:"6 mL/kg IBW", rr:"20–24", peep:"8–10, titrate up", fio2:"100% then titrate to SpO2 ≥90%", trigger:"Flow, 1–3 L/min", flow:"40–60 L/min, decelerating", ie:"1:1 to 1:1.5", note:"Target plateau pressure <30cmH2O; permissive hypercapnia acceptable." },
  asthma:    { label:"Asthma / severe bronchospasm", mode:"Volume control", tv:"6–8 mL/kg IBW", rr:"8–10 (low)", peep:"0–5 (minimal — watch auto-PEEP)", fio2:"100% initially, titrate", trigger:"Flow, less sensitive to avoid auto-triggering", flow:"High, 60–80 L/min", ie:"1:4–1:5 (long expiratory time)", note:"Permissive hypercapnia. Watch for breath-stacking / dynamic hyperinflation; disconnect and decompress if hypotensive." },
  copd:      { label:"COPD", mode:"Volume or pressure control", tv:"6–8 mL/kg IBW", rr:"10–12", peep:"Match intrinsic PEEP, often 3–5", fio2:"Titrate to SpO2 88–92%", trigger:"Flow", flow:"High, decelerating", ie:"1:3–1:4", note:"Watch for auto-PEEP; allow full exhalation." },
  dka:       { label:"DKA / metabolic acidosis", mode:"Volume control", tv:"6–8 mL/kg IBW", rr:"Match pre-intubation minute ventilation (often 20–30)", peep:"5", fio2:"Titrate to SpO2 ≥94%", trigger:"Flow", flow:"High to allow adequate expiratory time at high RR", ie:"Short — prioritize matching prior compensatory hyperventilation", note:"Avoid hypoventilation post-intubation — a sudden drop in minute ventilation can worsen acidosis rapidly." },
  tbi:       { label:"Traumatic brain injury", mode:"Volume control", tv:"6–8 mL/kg IBW", rr:"Titrate to normocapnia (PaCO2 35–40)", peep:"5 (avoid excess — can raise ICP via venous congestion)", fio2:"Titrate to SpO2 ≥94%, avoid hyperoxia", trigger:"Flow", flow:"Moderate", ie:"1:2", note:"Avoid routine hyperventilation unless actively herniating; avoid hypoxia and hypotension." },
  pulmonary_edema: { label:"Pulmonary edema", mode:"Volume or pressure control", tv:"6 mL/kg IBW", rr:"14–18", peep:"8–12", fio2:"Titrate to SpO2 ≥94%", trigger:"Flow", flow:"Moderate", ie:"1:2", note:"Higher PEEP helps recruit flooded alveoli and reduce preload." },
  hyperk:    { label:"Hyperkalemia arrest / peri-arrest", mode:"Volume control", tv:"6–8 mL/kg IBW", rr:"12–16, adjust to clinical state", peep:"5", fio2:"100% initially", trigger:"Flow", flow:"Moderate", ie:"1:2", note:"Avoid succinylcholine for RSI in known/suspected hyperkalemia. Treat hyperkalemia (calcium, insulin/dextrose, salbutamol) in parallel." },
  rosc:      { label:"Post-ROSC", mode:"Volume control", tv:"6–8 mL/kg IBW", rr:"10–12, titrate to PaCO2 35–45", peep:"5, titrate to oxygenation", fio2:"Titrate down to SpO2 94–98% (avoid hyperoxia)", trigger:"Flow", flow:"Moderate", ie:"1:2", note:"Avoid hyperventilation and hyperoxia; target normocapnia/normoxia and consider temperature control per local protocol." }
};

/* ---- Pediatric weight estimation (age in years -> kg), simplified APLS formula ---- */
function pediatricWeightEstimate(ageYears){
  if(ageYears == null || isNaN(ageYears)) return null;
  if(ageYears < 1) return Math.round((ageYears*12*0.5 + 4)*10)/10; // rough infant estimate
  if(ageYears <= 5) return (2*ageYears)+8;
  if(ageYears <= 12) return (3*ageYears)+7;
  return null; // use adult approach beyond 12
}

/* ---- Cormack-Lehane grading (for documentation) ---- */
const CORMACK_LEHANE = [
  { v:"1", label:"Grade 1 — full glottis visible" },
  { v:"2", label:"Grade 2 — partial glottis / arytenoids only" },
  { v:"3", label:"Grade 3 — epiglottis only, no glottis seen" },
  { v:"4", label:"Grade 4 — no airway structures seen" }
];
