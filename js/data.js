/* ==========================================================================
   DATA.JS — All clinical data, drug info, ventilator presets, LEMON criteria
   Edit here to change doses, timelines, presets — flows through every screen.
   ========================================================================== */

"use strict";

const DATA = {

  /* ---------- LEMON difficult airway assessment ---------- */
  lemon: {
    external: [
      { id: "large_tongue",    label: "Large tongue" },
      { id: "short_neck",      label: "Short, thick neck" },
      { id: "limited_mouth",   label: "Limited mouth opening (<3 cm)" },
      { id: "dentition",       label: "Poor dentition / prominent incisors" },
      { id: "facial_hair",     label: "Facial hair (beard)" },
      { id: "obesity",         label: "Obesity (BMI >30)" },
    ],
    look: [
      { id: "mallampati_3_4",  label: "Mallampati III–IV" },
      { id: "macroglossia",    label: "Macroglossia" },
      { id: "uvula",           label: "Uvula not visible" },
    ],
    evaluate_3_3: [
      { id: "interincisor",    label: "Inter-incisor distance <3 finger-breadths" },
      { id: "thyromental",     label: "Thyromental distance <3 finger-breadths" },
    ],
    mallampati: [
      { id: "mallampati",      label: "Mallampati class ≥III" },
    ],
    neck: [
      { id: "neck_mobility",   label: "Limited neck mobility (cervical collar, arthritis)" },
    ],
    obstruction: [
      { id: "airway_obstruction", label: "Airway obstruction (tumor, epiglottitis, trauma)" },
      { id: "stridor",           label: "Stridor at rest" },
    ],
    scoring: {
      green: { max: 1, label: "Low risk", rec: "Standard RSI approach", color: "green" },
      amber: { min: 2, max: 3, label: "Moderate risk", rec: "Senior review — consider video laryngoscopy, awake look", color: "amber" },
      red:   { min: 4, max: 99, label: "High risk", rec: "Awake airway strategy — consider fiberoptic / surgical standby", color: "red" },
    },
  },

  /* ---------- Pre-RSI checklist (challenge-response) ---------- */
  preRSIChecklist: [
    { id: "monitor",    label: "Monitoring attached?",           icon: "📊" },
    { id: "suction",    label: "Suction on & working?",          icon: "🫧" },
    { id: "oxygen",     label: "Oxygen pre-oxygenating?",        icon: "💨" },
    { id: "bougie",     label: "Bougie / stylet ready?",         icon: "🔧" },
    { id: "cric_kit",   label: "Cricothyrotomy kit at bedside?", icon: "🔪" },
    { id: "drugs",      label: "All drugs drawn up?",            icon: "💉" },
    { id: "capno",      label: "Capnography connected?",         icon: "📈" },
    { id: "assistant",  label: "Assistant briefed & ready?",     icon: "👤" },
    { id: "plan_b",     label: "Plan B discussed?",              icon: "📋" },
    { id: "position",   label: "Patient positioned (ear-to-sternal notch)?", icon: "🛏️" },
  ],

  /* ---------- RSI workflow steps with branching ---------- */
  rsiSteps: {
    adult: [
      {
        id: "preparation",
        name: "Preparation",
        checklist: true,  // gates on preRSIChecklist
        content: "Complete the airway checklist before proceeding.",
      },
      {
        id: "preoxygenation",
        name: "Pre-oxygenation",
        content: "3 minutes of 100% O₂ via NRB, or 8 vital capacity breaths.",
        decision: {
          question: "Is pre-oxygenation adequate? (SpO₂ ≥95%, end-tidal O₂ ≥90%)",
          yes: { next: "induction", label: "Yes — Continue RSI" },
          no: {
            label: "No — Inadequate",
            branches: [
              { id: "niv", label: "Try NIV (CPAP/BiPAP)", next: "induction", note: "Reassess SpO₂ after 2 min NIV" },
              { id: "bvm", label: "BVM ventilation", next: "induction", note: "Two-person BVM with OPA/NPA" },
              { id: "dsi", label: "Delayed Sequence Intubation", next: "induction", note: "Ketamine sedation for toleration of pre-oxygenation" },
            ],
          },
        },
      },
      {
        id: "induction",
        name: "Induction & Paralysis",
        drugChoice: true,
        content: "Push sedative agent, wait for onset (loss of eyelash reflex), then push paralytic.",
        drugSequence: ["sedative", "paralytic"],
      },
      {
        id: "wait_paralysis",
        name: "Wait for Paralysis",
        timer: { duration: 60, label: "Wait for optimal intubating conditions" },
        content: "Monitor for fasciculations to cease. Do NOT attempt laryngoscopy until paralysis is optimal.",
      },
      {
        id: "laryngoscopy",
        name: "Laryngoscopy",
        timer: { startOnEnter: true, label: "Attempt timer — aim <30 seconds" },
        content: "Insert laryngoscope, visualize cords. Record Cormack-Lehane grade.",
        attemptTracking: true,
        fields: [
          { id: "cl_grade", label: "Cormack-Lehane Grade", type: "select", options: ["I", "II", "III", "IV"] },
          { id: "view_pct", label: "% Glottic Opening (POGO)", type: "number", suffix: "%" },
          { id: "bougie_used", label: "Bougie used?", type: "toggle" },
        ],
      },
      {
        id: "intubation",
        name: "Endotracheal Intubation",
        content: "Insert ETT, inflate cuff, confirm placement immediately.",
        fields: [
          { id: "ett_size", label: "ETT size (mm)", type: "number" },
          { id: "ett_depth", label: "ETT depth (cm at teeth)", type: "number" },
        ],
      },
      {
        id: "confirmation",
        name: "Tube Confirmation",
        content: "Confirm ETT placement using the hierarchy below. Capnography is the gold standard.",
        confirmSteps: [
          { id: "etco2",       label: "Continuous waveform ETCO₂ (gold standard)", primary: true },
          { id: "chest_rise",  label: "Bilateral chest rise" },
          { id: "breath_sounds", label: "Bilateral breath sounds" },
          { id: "no_epigastric", label: "No epigastric sounds" },
          { id: "tube_depth",  label: "Tube depth appropriate" },
          { id: "cxr",         label: "Chest X-ray ordered (later confirmation)" },
        ],
      },
      {
        id: "post_intubation",
        name: "Post-Intubation",
        content: "Secure tube, connect to ventilator, start sedation infusion, order CXR.",
        postIntubation: true,
      },
    ],
    child: [
      {
        id: "preparation",
        name: "Preparation",
        checklist: true,
        content: "Complete the airway checklist. Verify weight-based dosing. Have uncuffed AND cuffed ETT ready.",
      },
      {
        id: "preoxygenation",
        name: "Pre-oxygenation",
        content: "3 minutes of 100% O₂. Use appropriately sized face mask. Avoid gastric insufflation.",
        decision: {
          question: "Is pre-oxygenation adequate?",
          yes: { next: "induction", label: "Yes — Continue" },
          no: {
            label: "No — Inadequate",
            branches: [
              { id: "bvm_ped", label: "BVM with PEEP valve", next: "induction" },
              { id: "niv_ped", label: "NIV trial", next: "induction" },
            ],
          },
        },
      },
      {
        id: "induction",
        name: "Induction & Paralysis",
        drugChoice: true,
        content: "Weight-based dosing. Atropine pretreatment recommended <1 year or if succinylcholine used.",
        drugSequence: ["atropine_optional", "sedative", "paralytic"],
      },
      {
        id: "wait_paralysis",
        name: "Wait for Paralysis",
        timer: { duration: 60, label: "Wait for optimal conditions" },
        content: "Pediatric onset may be slightly faster. Monitor for fasciculations.",
      },
      {
        id: "laryngoscopy",
        name: "Laryngoscopy",
        timer: { startOnEnter: true, label: "Attempt timer" },
        content: "Straight blade (Miller) preferred <2 years. Cuffed ETT acceptable from term neonate.",
        attemptTracking: true,
        fields: [
          { id: "cl_grade", label: "Cormack-Lehane Grade", type: "select", options: ["I", "II", "III", "IV"] },
          { id: "bougie_used", label: "Bougie used?", type: "toggle" },
        ],
      },
      {
        id: "intubation",
        name: "ET Intubation",
        content: "Insert ETT, inflate cuff gently if cuffed. Confirm placement.",
        fields: [
          { id: "ett_size", label: "ETT size (mm)", type: "number" },
          { id: "ett_depth", label: "ETT depth (cm at lip)", type: "number" },
        ],
      },
      {
        id: "confirmation",
        name: "Tube Confirmation",
        content: "Same confirmation hierarchy. ETCO₂ is essential.",
        confirmSteps: [
          { id: "etco2",       label: "Continuous waveform ETCO₂", primary: true },
          { id: "chest_rise",  label: "Bilateral chest rise" },
          { id: "breath_sounds", label: "Bilateral breath sounds" },
          { id: "no_epigastric", label: "No epigastric sounds" },
          { id: "tube_depth",  label: "Tube depth appropriate" },
          { id: "cxr",         label: "Chest X-ray ordered" },
        ],
      },
      {
        id: "post_intubation",
        name: "Post-Intubation",
        content: "Secure tube, connect to ventilator, sedation infusion, CXR.",
        postIntubation: true,
      },
    ],
  },

  /* ---------- Drugs with enhanced info ---------- */
  drugs: {
    sedative: {
      label: "Sedatives / Induction Agents",
      agents: [
        {
          id: "ketamine",
          name: "Ketamine",
          dosePerKg: { adult: 1.5, child: 2 },
          unit: "mg",
          route: "IV",
          onset: "30 seconds",
          duration: "10–15 min",
          maxDose: 150,
          contraindications: [
            "Uncontrolled hypertension",
            "Aortic dissection",
            "Severe ischemic heart disease",
            "Raised intracranial pressure (relative)",
            "Known hypersensitivity",
          ],
          warnings: "Increases HR, BP, secretions. Consider glycopyrrolate for secretions. Emergence reactions reduced with benzodiazepine co-administration.",
          category: "dissociative",
        },
        {
          id: "propofol",
          name: "Propofol",
          dosePerKg: { adult: 1.5, child: 2.5 },
          unit: "mg",
          route: "IV",
          onset: "15–30 seconds",
          duration: "5–10 min",
          maxDose: 200,
          contraindications: [
            "Hemodynamic instability",
            "Egg/soy allergy (some formulations)",
            "Severe hypovolemia",
          ],
          warnings: "Causes hypotension — reduce dose in elderly, shocked patients. No analgesic effect. Consider co-induction with fentanyl.",
          category: "sedative-hypnotic",
        },
        {
          id: "etomidate",
          name: "Etomidate",
          dosePerKg: { adult: 0.3, child: 0.3 },
          unit: "mg",
          route: "IV",
          onset: "15–30 seconds",
          duration: "3–5 min",
          maxDose: 30,
          contraindications: [
            "Known hypersensitivity",
            "Adrenal insufficiency (relative — single dose generally safe)",
          ],
          warnings: "Hemodynamically neutral — good for shocked patients. Single dose only (adrenal suppression with repeated doses). Myoclonus common — pretreat with fentanyl to reduce.",
          category: "sedative-hypnotic",
        },
        {
          id: "midazolam",
          name: "Midazolam",
          dosePerKg: { adult: 0.1, child: 0.1 },
          unit: "mg",
          route: "IV",
          onset: "30–60 seconds",
          duration: "15–30 min",
          maxDose: 10,
          contraindications: [
            "Severe respiratory depression (without ventilation support)",
            "Acute narrow-angle glaucoma",
          ],
          warnings: "Weaker induction agent — often used as co-induction. Dose reduce in elderly, hepatic impairment. Flumazenil is reversal agent.",
          category: "benzodiazepine",
        },
        {
          id: "fentanyl",
          name: "Fentanyl",
          dosePerKg: { adult: 1.5, child: 1.5 },
          unit: "mcg",
          route: "IV",
          onset: "30–60 seconds",
          duration: "30–60 min",
          maxDose: 150,
          contraindications: [
            "Known hypersensitivity",
            "Severe respiratory depression (without ventilation)",
          ],
          warnings: "Use as co-induction agent (blunts sympathetic response). Can cause chest wall rigidity at high doses. Respiratory depression — ensure ventilation capability.",
          category: "opioid",
        },
      ],
    },
    paralytic: {
      label: "Neuromuscular Blockers",
      agents: [
        {
          id: "rocuronium",
          name: "Rocuronium",
          dosePerKg: { adult: 1.2, child: 1.2 },
          unit: "mg",
          route: "IV",
          onset: "45–60 seconds",
          duration: "45–70 min",
          maxDose: 120,
          contraindications: [
            "Known hypersensitivity",
          ],
          warnings: "First-line paralytic for RSI. Sugammadex provides complete reversal (16 mg/kg). Prefer over succinylcholine in most situations.",
          category: "non-depolarizing",
        },
        {
          id: "succinylcholine",
          name: "Succinylcholine",
          dosePerKg: { adult: 1.5, child: 2 },
          unit: "mg",
          route: "IV",
          onset: "30–60 seconds",
          duration: "5–10 min",
          maxDose: 150,
          contraindications: [
            "Hyperkalemia (K⁺ >5.5)",
            "Burns >24 hours old",
            "Crush injury >24 hours old",
            "Denervation injury >24 hours old",
            "Prolonged immobilization",
            "Personal/family history of malignant hyperthermia",
            "Myopathy / muscular dystrophy",
            "Penetrating eye injury (relative)",
          ],
          warnings: "Fasciculations common — pretreat with rocuronium 0.06 mg/kg (defasciculating dose). Risk of hyperkalemia in susceptible patients. Short duration — have repeat dose or alternative ready if first attempt fails.",
          category: "depolarizing",
        },
      ],
    },
    atropine_optional: {
      label: "Atropine (Pediatric Pretreatment)",
      agents: [
        {
          id: "atropine",
          name: "Atropine",
          dosePerKg: { adult: 0, child: 0.02 },
          unit: "mg",
          route: "IV",
          onset: "1–2 min",
          duration: "30–60 min",
          maxDose: 0.5,
          minDose: 0.1,
          contraindications: [
            "Known hypersensitivity",
          ],
          warnings: "Recommended for children <1 year, or when succinylcholine used. Prevents bradycardia. Minimum dose 0.1 mg.",
          category: "anticholinergic",
        },
      ],
    },
    post_intubation: {
      label: "Post-Intubation Infusions",
      agents: [
        {
          id: "propofol_inf",
          name: "Propofol infusion",
          doseRange: "5–50 mcg/kg/min",
          onset: "Immediate",
          duration: "Short-acting",
          contraindications: ["Hemodynamic instability", "Propofol infusion syndrome (prolonged high-dose >48h)"],
          warnings: "Titrate to RASS target. Monitor triglycerides if >48h. Consider enteral sedation to wean.",
          category: "sedative",
        },
        {
          id: "midazolam_inf",
          name: "Midazolam infusion",
          doseRange: "0.02–0.1 mg/kg/hr",
          onset: "1–3 min",
          duration: "Short-acting",
          contraindications: ["Severe hepatic impairment"],
          warnings: "Accumulates with prolonged use — consider daily sedation vacation. Renal/hepatic dose adjustment.",
          category: "benzodiazepine",
        },
        {
          id: "fentanyl_inf",
          name: "Fentanyl infusion",
          doseRange: "25–100 mcg/hr",
          onset: "Immediate",
          duration: "Short-acting",
          contraindications: ["Opioid sensitivity"],
          warnings: "For analgesia. Ensure sedation covers pain. Consider multimodal analgesia.",
          category: "opioid",
        },
        {
          id: "cisatracurium_inf",
          name: "Cisatracurium infusion",
          doseRange: "1–3 mcg/kg/min",
          onset: "2–3 min",
          duration: "Intermediate",
          contraindications: ["Known hypersensitivity"],
          warnings: "Only for ventilator dyssynchrony not resolved by sedation. Train-of-four monitoring required. Daily interruption recommended.",
          category: "paralytic",
        },
      ],
    },
  },

  /* ---------- Failed airway algorithm (decision tree) ---------- */
  failedAirway: {
    root: {
      id: "cannot_intubate",
      question: "Cannot Intubate",
      children: [
        {
          id: "can_oxygenate",
          question: "Can you oxygenate? (SpO₂ >90%)",
          yes: {
            id: "ci_co_yes",
            label: "YES — CICO resolved",
            action: "Supraglottic airway (LMA/i-gel)",
            steps: [
              "Insert supraglottic airway (LMA / i-gel)",
              "Confirm ventilation with ETCO₂",
              "If effective: use as bridge — plan definitive airway",
              "If ineffective: reposition, try second SGA",
              "If still ineffective: treat as CICO",
            ],
            outcome: "green",
          },
          no: {
            id: "ci_co_no",
            label: "NO — CICO (Cannot Intubate, Cannot Oxygenate)",
            action: "Emergency front-of-neck access",
            steps: [
              "Declare: 'CICO — proceeding to surgical cricothyrotomy'",
              "Position: extend neck, identify cricothyroid membrane",
              "Stabilize larynx with non-dominant hand",
              "Horizontal skin incision through membrane",
              "Dilate with forceps or bougie-guided technique",
              "Insert 6.0 cuffed ETT or tracheostomy tube",
              "Confirm with ETCO₂",
              "Ventilate and secure",
            ],
            checklist: [
              { id: "scalpel", label: "Scalpel (#10 or #20 blade)" },
              { id: "bougie_cric", label: "Bougie" },
              { id: "ett_6", label: "6.0 ETT or tracheostomy tube" },
              { id: "syringe", label: "10 mL syringe" },
              { id: "connector", label: "ETT connector / adapter" },
            ],
            outcome: "red",
          },
        },
      ],
    },
  },

  /* ---------- Ventilator presets (evidence-based) ---------- */
  ventilatorPresets: [
    {
      id: "ards",
      name: "ARDS",
      subtitle: "Acute Respiratory Distress Syndrome",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6 mL/kg IBP (lung protective)",
        RR: "20–30 bpm",
        PEEP: "10–15 cmH₂O (per ARDSNet table)",
        FiO₂: "Titrate to SpO₂ 88–95%",
        trigger: "Flow trigger 1–2 L/min",
        inspiratory_flow: "60 L/min (square waveform)",
        ie_ratio: "1:1.5–1:2",
        plateau: "≤30 cmH₂O target",
      },
      notes: "Prone positioning if P/F <150. Neuromuscular blockade if P/F <150 in first 48h. Conservative fluid strategy.",
    },
    {
      id: "asthma",
      name: "Asthma",
      subtitle: "Status asthmaticus / bronchospasm",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6–8 mL/kg IBP",
        RR: "10–14 bpm (allow permissive hypercapnia)",
        PEEP: "0–5 cmH₂O (auto-PEEP risk)",
        FiO₂: "Titrate to SpO₂ >92%",
        trigger: "Flow trigger 2 L/min",
        inspiratory_flow: "80–100 L/min (high flow for short I-time)",
        ie_ratio: "1:3–1:4 (long expiration)",
        plateau: "Monitor for auto-PEEP",
      },
      notes: "Permissive hypercapnia acceptable. Avoid auto-PEEP — disconnect and decompress if dynamic hyperinflation. Bronchodilators IV and inhaled.",
    },
    {
      id: "copd",
      name: "COPD",
      subtitle: "Acute exacerbation / acute-on-chronic",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6–8 mL/kg IBP",
        RR: "12–16 bpm",
        PEEP: "5–8 cmH₂O (match auto-PEEP)",
        FiO₂: "Titrate to SpO₂ 88–92% (avoid over-oxygenation)",
        trigger: "Flow trigger 1–2 L/min",
        inspiratory_flow: "60 L/min",
        ie_ratio: "1:2.5–1:3",
        plateau: "Monitor for auto-PEEP",
      },
      notes: "Target permissive hypoxemia (88–92%). Watch for auto-PEEP. Bicarbonate infusion if pH <7.2.",
    },
    {
      id: "tbi",
      name: "TBI",
      subtitle: "Traumatic Brain Injury",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6–8 mL/kg IBP",
        RR: "16–20 bpm (target PaCO₂ 35–40 mmHg)",
        PEEP: "5–8 cmH₂O",
        FiO₂: "Titrate to SpO₂ >95%, PaO₂ >100 mmHg",
        trigger: "Flow trigger 1–2 L/min",
        inspiratory_flow: "60 L/min",
        ie_ratio: "1:2",
        plateau: "≤30 cmH₂O",
      },
      notes: "Head of bed ≥30°. Avoid hypoxia and hypotension (SBP >100 mmHg). ICP management per neuro protocol. Avoid hyperthermia.",
    },
    {
      id: "pulm_edema",
      name: "Pulmonary Edema",
      subtitle: "Cardiogenic / fluid overload",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6–8 mL/kg IBP",
        RR: "16–20 bpm",
        PEEP: "8–15 cmH₂O (therapeutic PEEP)",
        FiO₂: "Titrate to SpO₂ >92%",
        trigger: "Flow trigger 1–2 L/min",
        inspiratory_flow: "60 L/min",
        ie_ratio: "1:2",
        plateau: "≤30 cmH₂O",
      },
      notes: "Therapeutic PEEP reduces preload and afterload. Diuresis. Consider nitroglycerin. Monitor hemodynamics closely with PEEP changes.",
    },
    {
      id: "dka",
      name: "DKA",
      subtitle: "Diabetic Ketoacidosis",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6–8 mL/kg IBP",
        RR: "16–20 bpm (may need higher to compensate metabolic acidosis)",
        PEEP: "5 cmH₂O",
        FiO₂: "Titrate to SpO₂ >94%",
        trigger: "Flow trigger 1–2 L/min",
        inspiratory_flow: "60 L/min",
        ie_ratio: "1:2",
        plateau: "≤30 cmH₂O",
      },
      notes: "Match pre-intubation respiratory rate (patient was compensating). Aggressive fluid resuscitation. Insulin infusion. Monitor potassium closely.",
    },
    {
      id: "post_rosc",
      name: "Post-ROSC",
      subtitle: "After return of spontaneous circulation",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6 mL/kg IBP",
        RR: "10–12 bpm",
        PEEP: "5–8 cmH₂O",
        FiO₂: "Titrate to SpO₂ 94–98% (avoid hyperoxia)",
        trigger: "Flow trigger 1–2 L/min",
        inspiratory_flow: "60 L/min",
        ie_ratio: "1:2",
        plateau: "≤30 cmH₂O",
      },
      notes: "Avoid hyperoxia (aim SpO₂ 94–98%). Avoid hyperventilation. Targeted temperature management (32–36°C). Hemodynamic support.",
    },
    {
      id: "hyperkalemia_arrest",
      name: "Hyperkalemia Arrest",
      subtitle: "Cardiac arrest secondary to hyperkalemia",
      params: {
        mode: "Volume Control (AC/VC)",
        TV: "6 mL/kg IBP",
        RR: "10–12 bpm",
        PEEP: "5 cmH₂O",
        FiO₂: "100% during arrest",
        trigger: "Flow trigger 1–2 L/min",
        inspiratory_flow: "60 L/min",
        ie_ratio: "1:2",
        plateau: "≤30 cmH₂O",
      },
      notes: "Treat K⁺: Calcium chloride 10% 10mL IV, Insulin 10U + D50 50mL, Saline bolus, Sodium bicarbonate 50mL (8.4%), Nebulized salbutamol. Continue CPR.",
    },
  ],

  /* ---------- Tube confirmation hierarchy ---------- */
  tubeConfirmation: [
    { id: "etco2",       label: "Continuous waveform ETCO₂",   icon: "📈", primary: true, note: "Gold standard — 6 consecutive waveforms" },
    { id: "chest_rise",  label: "Bilateral chest rise",        icon: "🫁", primary: false },
    { id: "breath_sounds", label: "Bilateral breath sounds",   icon: "👂", primary: false },
    { id: "no_epigastric", label: "No epigastric sounds",      icon: "✅", primary: false },
    { id: "tube_depth",  label: "Tube depth at teeth/lip",     icon: "📏", primary: false },
    { id: "fogging",     label: "Fogging in tube",             icon: "💨", primary: false },
    { id: "cxr",         label: "Chest X-ray (later)",         icon: "📷", primary: false, note: "Ordered — not for immediate confirmation" },
  ],

  /* ---------- Tube size defaults ---------- */
  tubeDefaults: {
    adult: { male: { size: 8.0, depth: 22 }, female: { size: 7.0, depth: 20 } },
    child_formula: "Age/4 + 4",
    depth_formula: "Size × 3",
  },

  /* ---------- LMA sizes ---------- */
  lmaSizes: [
    { weight: "<5 kg",    size: "1", blade: "—" },
    { weight: "5–10 kg",  size: "1.5", blade: "—" },
    { weight: "10–20 kg", size: "2", blade: "—" },
    { weight: "20–30 kg", size: "2.5", blade: "—" },
    { weight: "30–50 kg", size: "3", blade: "—" },
    { weight: "50–70 kg", size: "4", blade: "—" },
    { weight: "70–100 kg", size: "5", blade: "—" },
    { weight: ">100 kg",  size: "5", blade: "—" },
  ],

  /* ---------- Vasopressor infusion rates ---------- */
  vasopressors: [
    { id: "norepinephrine", name: "Norepinephrine", conc: 0.004, unit: "mg/mL", defaultConc: "4 mg/250 mL", rates: [
      { label: "Low", dose: 0.05 },
      { label: "Medium", dose: 0.1 },
      { label: "High", dose: 0.2 },
      { label: "Max", dose: 0.5 },
    ]},
    { id: "epinephrine", name: "Epinephrine", conc: 0.016, unit: "mg/mL", defaultConc: "4 mg/250 mL", rates: [
      { label: "Low", dose: 0.01 },
      { label: "Medium", dose: 0.05 },
      { label: "High", dose: 0.1 },
      { label: "Max", dose: 0.5 },
    ]},
    { id: "dopamine", name: "Dopamine", conc: 1.6, unit: "mg/mL", defaultConc: "400 mg/250 mL", rates: [
      { label: "Renal", dose: 2 },
      { label: "Cardiac", dose: 5 },
      { label: "Pressor", dose: 10 },
      { label: "Max", dose: 20 },
    ]},
    { id: "phenylephrine", name: "Phenylephrine", conc: 0.1, unit: "mg/mL", defaultConc: "20 mg/200 mL", rates: [
      { label: "Low", dose: 0.5 },
      { label: "Medium", dose: 1 },
      { label: "High", dose: 2 },
      { label: "Max", dose: 5 },
    ]},
    { id: "vasopressin", name: "Vasopressin", conc: 0.02, unit: "U/mL", defaultConc: "20 U/1000 mL", rates: [
      { label: "Fixed", dose: 0.04 },
    ]},
  ],

  /* ---------- Patient categories for dosing ---------- */
  patientCategories: [
    { id: "adult",       label: "Adult",       note: "Standard adult dosing" },
    { id: "obese",       label: "Obese",       note: "Dose to IBW unless noted" },
    { id: "elderly",     label: "Elderly (>65)", note: "Reduce sedatives 25–50%" },
    { id: "pediatric",   label: "Pediatric",   note: "Weight-based dosing" },
    { id: "neonate",     label: "Neonate",     note: "<28 days — special dosing" },
  ],

  /* ---------- Report template ---------- */
  reportTemplate: {
    title: "Rapid Sequence Intubation — Procedure Report",
    sections: [
      { id: "indication", label: "Indication" },
      { id: "airway_assessment", label: "Airway Assessment" },
      { id: "lemon_score", label: "LEMON Score" },
      { id: "preoxygenation", label: "Pre-oxygenation" },
      { id: "drugs", label: "Drugs Administered" },
      { id: "timeline", label: "Timeline" },
      { id: "attempts", label: "Laryngoscopy Attempts" },
      { id: "cl_grade", label: "Cormack-Lehane Grade" },
      { id: "bougie", label: "Bougie Used" },
      { id: "tube", label: "Tube Details" },
      { id: "confirmation", label: "Tube Confirmation" },
      { id: "complications", label: "Complications" },
      { id: "operator", label: "Operator" },
      { id: "assistant", label: "Assistant" },
      { id: "ventilator", label: "Ventilator Settings" },
      { id: "sedation", label: "Post-Intubation Sedation" },
    ],
  },
};
