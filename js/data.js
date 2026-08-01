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
  { id:"ketamine",  name:"Ketamine",  dose:2,    unit:"mg/kg IV", note:"Preferred in shock, asthma, hemodynamic instability.", bestFor:["shock","asthma","head"] },
  { id:"midazolam", name:"Midazolam", dose:0.175, range:"0.15–0.2", unit:"mg/kg IV", note:"Reduce dose in elderly / critically ill." },
  { id:"etomidate", name:"Etomidate", dose:0.3,  unit:"mg/kg IV", note:"Hemodynamically neutral; avoid in septic shock (adrenal suppression) if alternatives exist.", bestFor:["head"] },
  { id:"propofol",  name:"Propofol",  dose:1.5,  range:"1–2.5", unit:"mg/kg IV", note:"Causes hypotension — use cautiously in shock." }
];

/* ---- Neuromuscular blockers ---- */
const NMB = [
  { id:"sux", name:"Succinylcholine", dose:1.5, unit:"mg/kg IV (adult)", pedDose:2, pedUnit:"mg/kg IV (infant)", onset:"45–60s", duration:"6–10 min",
    contraindications:["Hyperkalaemia (e.g. renal failure)","Organophosphate poisoning","Delayed severe burns (>24h)","Prolonged crush injury"] },
  { id:"roc", name:"Rocuronium", dose:1.2, unit:"mg/kg IV", onset:"~60s", duration:"20–35 min", note:"Preferred nondepolarizer for ED RSI; reversible with sugammadex." }
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

/* ---- RSI workflow steps (drive the main step screen + progress bar) ---- */
const RSI_STEPS = [
  { id:"lemon",   label:"LEMON / Preparation", voice:"Assess for a difficult airway and prepare equipment." },
  { id:"equip",   label:"Equipment", voice:"Check your airway equipment." },
  { id:"preox",   label:"Preoxygenation", voice:"Begin preoxygenation." },
  { id:"position",label:"Position", voice:"Position the patient." },
  { id:"induction",label:"Induction", voice:"Administer induction drug." },
  { id:"paralytic",label:"Paralytic", voice:"Administer paralytic." },
  { id:"waiting", label:"Waiting for paralysis", voice:"Waiting for paralysis." },
  { id:"laryngoscopy",label:"Laryngoscopy", voice:"Laryngoscopy now." },
  { id:"confirm", label:"Confirm tube placement", voice:"Confirm waveform capnography." },
  { id:"secure",  label:"Secure & document", voice:"Secure the tube and document." }
];

/* ---- Equipment checklist (MALE MESS) ---- */
const EQUIPMENT_CHECKLIST = [
  "Mask", "Airways (oral / nasal)", "Laryngoscopes & LMA", "Endotracheal tubes (2 sizes)",
  "Monitoring — SpO2, ECG, capnography", "Magill forceps", "Emergency drugs / trolley",
  "Self-inflating bag-valve resuscitator", "Suction, stylet, bougie", "Plentiful oxygen supply", "Cric kit"
];

/* ---- Tube confirmation checklist ---- */
const CONFIRMATION_CHECKLIST = [
  "Waveform ETCO₂ present (35–45mmHg)",
  "Bilateral air entry on auscultation",
  "Equal, symmetric chest rise",
  "No gastric insufflation sounds on epigastric auscultation",
  "Tube secured at correct depth"
];

/* ---- Failed airway algorithm (tap for detail) ---- */
const FAILED_AIRWAY = [
  { id:"a1", label:"Attempt 1 fails", detail:"Optimize position, consider larger blade, external laryngeal manipulation. Do not exceed 30s per attempt." },
  { id:"bougie", label:"Bougie", detail:"Use a bougie/introducer on next attempt — tactile click and hold-up confirm tracheal placement." },
  { id:"a2", label:"Attempt 2 fails", detail:"Change laryngoscopist / blade / technique. Maximum 2 attempts by the same operator before escalating." },
  { id:"lma", label:"LMA / supraglottic airway", detail:"Insert a supraglottic airway to restore oxygenation while planning definitive airway." },
  { id:"cantox", label:"Can't oxygenate", detail:"If SpO2 falling and BVM/LMA ventilation inadequate — this is a 'can't intubate, can't oxygenate' emergency." },
  { id:"cric", label:"Scalpel cricothyrotomy", detail:"Proceed immediately to surgical airway. See Cricothyrotomy module for step-by-step guide." }
];

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

/* ---- Ventilator presets (initial settings, adult 70kg reference) ---- */
const VENT_PRESETS = {
  ards:      { label:"ARDS", settings:"TV 6mL/kg IBW · RR 20–24 · PEEP 8–10 · FiO2 100% then titrate · Plateau <30cmH2O" },
  asthma:    { label:"Asthma / severe bronchospasm", settings:"TV 6–8mL/kg · RR 8–10 · I:E 1:4–1:5 · Permissive hypercapnia · Low PEEP" },
  copd:      { label:"COPD", settings:"TV 6–8mL/kg · RR 10–12 · Long expiratory time · Watch for auto-PEEP" },
  dka:       { label:"DKA / metabolic acidosis", settings:"Match pre-intubation minute ventilation closely · High RR often needed · Avoid hypoventilation" },
  head:      { label:"Head injury", settings:"TV 6–8mL/kg · RR to target normocapnia (PaCO2 35–40) · Avoid hyperventilation unless herniating" },
  pulmonary_edema: { label:"Pulmonary edema", settings:"TV 6mL/kg IBW · PEEP 8–12 · FiO2 titrate to SpO2 ≥94%" }
};

/* ---- Pediatric weight estimation (age in years -> kg), simplified APLS formula ---- */
function pediatricWeightEstimate(ageYears){
  if(ageYears == null || isNaN(ageYears)) return null;
  if(ageYears < 1) return Math.round((ageYears*12*0.5 + 4)*10)/10; // rough infant estimate
  if(ageYears <= 5) return (2*ageYears)+8;
  if(ageYears <= 12) return (3*ageYears)+7;
  return null; // use adult approach beyond 12
}
