/* ==========================================================================
   APP.JS — Routing, all other screens, install/service-worker wiring
   ========================================================================== */

"use strict";

const App = (() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  let deferredInstall = null;
  let currentScreen = "dashboard";

  /* ---- Boot ---- */
  async function boot() {
    await Store.open();
    await loadSettings();
    bindNav();
    bindBack();
    bindSettings();
    bindRSIButtons();
    bindEmergencyOverlay();
    bindCalculatorScreen();
    bindFailedAirway();
    bindCric();
    bindVentilatorScreen();
    bindCalculatorsScreen();
    bindReports();
    registerSW();
    navigateTo("dashboard");
  }

  /* ---- Navigation ---- */
  function navigateTo(screen, opts) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    const el = $(`#screen-${screen}`);
    if (el) el.classList.add("active");
    currentScreen = screen;

    // Title
    const titles = {
      dashboard: "ER Airway Assistant",
      rsi: "RSI Workflow",
      calculator: "Drug Calculator",
      failed: "Failed Airway Algorithm",
      cric: "Cricothyrotomy",
      ventilator: "Ventilator Presets",
      calculators: "Airway Calculators",
      reports: "Case Reports",
      settings: "Settings",
    };
    $("#screenTitle").textContent = titles[screen] || "ER Airway Assistant";
    $("#backBtn").hidden = screen === "dashboard";

    // Initialize screens
    if (screen === "rsi" && opts?.mode) RSI.init(opts.mode);
    if (screen === "failed") renderFailedAirway();
    if (screen === "ventilator") renderVentilatorGrid();
    if (screen === "reports") renderReports();
    if (screen === "calculator") renderCalculatorScreen();
  }

  function bindNav() {
    $$("[data-nav]").forEach((el) => {
      el.addEventListener("click", () => {
        const nav = el.dataset.nav;
        const mode = el.dataset.mode;
        navigateTo(nav, { mode });
      });
    });
  }

  function bindBack() {
    $("#backBtn").addEventListener("click", () => {
      if (currentScreen === "rsi") {
        // Confirm exit
        if (confirm("Leave RSI workflow? Progress will be saved in timeline.")) {
          navigateTo("dashboard");
        }
      } else {
        navigateTo("dashboard");
      }
    });
  }

  function bindSettings() {
    $("#settingsBtn").addEventListener("click", () => navigateTo("settings"));
  }

  /* ---- RSI buttons ---- */
  function bindRSIButtons() {
    $("#rsiNext").addEventListener("click", () => RSI.next());
    $("#rsiBack").addEventListener("click", () => RSI.back());
    $("#rsiEmergency").addEventListener("click", () => {
      $("#emergencyOverlay").hidden = false;
      RSI.triggerEmergency();
    });
  }

  /* ---- Emergency overlay ---- */
  function bindEmergencyOverlay() {
    $("#emgToFailed").addEventListener("click", () => {
      $("#emergencyOverlay").hidden = true;
      navigateTo("failed");
    });
    $("#emgResume").addEventListener("click", () => {
      $("#emergencyOverlay").hidden = true;
    });
  }

  /* ---- Settings ---- */
  async function loadSettings() {
    const dark = await Store.getSetting("dark", false);
    const voice = await Store.getSetting("voice", true);
    const vibrate = await Store.getSetting("vibrate", true);
    $("#setDark").checked = dark;
    $("#setVoice").checked = voice;
    $("#setVibrate").checked = vibrate;
    if (dark) document.body.classList.add("dark");
    Voice.setEnabled(voice);

    $("#setDark").addEventListener("change", async () => {
      const v = $("#setDark").checked;
      document.body.classList.toggle("dark", v);
      await Store.setSetting("dark", v);
    });
    $("#setVoice").addEventListener("change", async () => {
      const v = $("#setVoice").checked;
      Voice.setEnabled(v);
      await Store.setSetting("voice", v);
    });
    $("#setVibrate").addEventListener("change", async () => {
      await Store.setSetting("vibrate", $("#setVibrate").checked);
    });
  }

  /* ---- Register SW ---- */
  function registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstall = e;
      const btn = $("#installBtn");
      btn.hidden = false;
      btn.addEventListener("click", async () => {
        deferredInstall.prompt();
        const result = await deferredInstall.userChoice;
        deferredInstall = null;
        btn.hidden = true;
      });
    });
  }

  /* ========== DRUG CALCULATOR SCREEN ========== */
  function bindCalculatorScreen() {}

  function renderCalculatorScreen() {
    const container = $("#calcCategoryChips");
    if (!container) return;
    container.innerHTML = DATA.patientCategories.map((c) =>
      `<div class="chip" data-cat="${c.id}">${c.label}</div>`
    ).join("");

    let category = "adult";
    let weight = 70;

    container.querySelectorAll("[data-cat]").forEach((el) => {
      el.addEventListener("click", () => {
        container.querySelectorAll("[data-cat]").forEach((c) => c.classList.remove("active"));
        el.classList.add("active");
        category = el.dataset.cat;
        const cat = DATA.patientCategories.find((c) => c.id === category);
        $("#calcCategoryNote").textContent = cat?.note || "";
        renderDoseTables(category, weight);
      });
    });

    // Default selection
    container.querySelector('[data-cat="adult"]')?.classList.add("active");

    $("#calcWeight")?.addEventListener("input", (e) => {
      weight = parseFloat(e.target.value) || 70;
      renderDoseTables(category, weight);
    });

    renderDoseTables(category, weight);
  }

  function renderDoseTables(category, weight) {
    // Sedatives
    renderDrugTable("calcSedTable", DATA.drugs.sedative.agents, weight, category);
    // NMB
    renderDrugTable("calcNmbTable", DATA.drugs.paralytic.agents, weight, category);
    // Infusions
    renderInfusionTable("calcInfTable", DATA.drugs.post_intubation.agents);
  }

  function renderDrugTable(tableId, agents, weight, category) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let html = `<thead><tr><th>Drug</th><th>Dose/kg</th><th>Calculated</th><th>Details</th></tr></thead><tbody>`;
    for (const agent of agents) {
      const isPediatric = category === "pediatric" || category === "neonate";
      const dosePerKg = isPediatric ? (agent.dosePerKg.child || agent.dosePerKg.adult) : agent.dosePerKg.adult;
      let dose = Calc.drugDose(dosePerKg, weight, agent.maxDose, agent.minDose);
      let doseDisplay = `${dose} ${agent.unit}`;

      // Elderly reduction
      if (category === "elderly" && (agent.category === "sedative-hypnotic" || agent.category === "benzodiazepine" || agent.category === "dissociative")) {
        const reduced = Math.round(dose * 0.75 * 10) / 10;
        doseDisplay = `${reduced} ${agent.unit} <small style="color:var(--amber)">(↓25% elderly)</small>`;
        dose = reduced;
      }

      html += `<tr>
        <td><strong>${agent.name}</strong><br><small style="color:var(--text-muted)">${agent.category || ""}</small></td>
        <td>${dosePerKg} ${agent.unit}/kg</td>
        <td class="dose-val">${doseDisplay}</td>
        <td><small>
          ⏱ ${agent.onset || "—"}<br>
          ⏳ ${agent.duration || "—"}
          ${agent.contraindications?.length ? `<br>⚠ ${agent.contraindications.length} contraindication(s)` : ""}
        </small></td>
      </tr>`;
    }
    html += `</tbody>`;
    table.innerHTML = html;

    // Click rows to show detail
    table.querySelectorAll("tr").forEach((row, i) => {
      if (i === 0) return;
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        const agent = agents[i - 1];
        showDrugDetailModal(agent, weight, category);
      });
    });
  }

  function renderInfusionTable(tableId, agents) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let html = `<thead><tr><th>Infusion</th><th>Rate</th><th>Notes</th></tr></thead><tbody>`;
    for (const agent of agents) {
      html += `<tr>
        <td><strong>${agent.name}</strong></td>
        <td class="dose-val">${agent.doseRange}</td>
        <td><small>${agent.warnings || "—"}</small></td>
      </tr>`;
    }
    html += `</tbody>`;
    table.innerHTML = html;
  }

  function showDrugDetailModal(agent, weight, category) {
    const overlay = $("#emergencyOverlay");
    const content = overlay.querySelector(".overlay-content");
    const isPediatric = category === "pediatric" || category === "neonate";
    const dosePerKg = isPediatric ? (agent.dosePerKg?.child || agent.dosePerKg?.adult) : agent.dosePerKg?.adult;
    let dose = dosePerKg ? Calc.drugDose(dosePerKg, weight, agent.maxDose, agent.minDose) : null;

    let html = `<h2>${agent.name}</h2>`;
    if (dose !== null) html += `<div style="font-size:2rem;font-weight:800;color:var(--accent);margin:10px 0">${dose} ${agent.unit}</div>`;
    html += `<dl class="drug-meta" style="text-align:left;width:100%">`;
    if (agent.onset) { html += `<dt>Onset</dt><dd>${agent.onset}</dd>`; }
    if (agent.duration) { html += `<dt>Duration</dt><dd>${agent.duration}</dd>`; }
    if (agent.route) { html += `<dt>Route</dt><dd>${agent.route}</dd>`; }
    if (dosePerKg) { html += `<dt>Dose/kg</dt><dd>${dosePerKg} ${agent.unit}/kg</dd>`; }
    html += `</dl>`;
    if (agent.contraindications?.length) {
      html += `<div class="drug-warn" style="text-align:left;margin-top:14px"><strong>Avoid in:</strong><br>${agent.contraindications.join("<br>")}</div>`;
    }
    if (agent.warnings) {
      html += `<div class="drug-warn" style="text-align:left;margin-top:8px;background:var(--amber-bg);border-color:rgba(255,183,77,.2);color:var(--amber)">${agent.warnings}</div>`;
    }
    html += `<button class="bigbtn ghost" style="margin-top:16px;width:100%" onclick="document.getElementById('emergencyOverlay').hidden=true">Close</button>`;
    content.innerHTML = html;
    overlay.hidden = false;
  }

  /* ========== FAILED AIRWAY ALGORITHM ========== */
  function bindFailedAirway() {}

  function renderFailedAirway() {
    const flow = $("#failedFlow");
    if (!flow) return;
    const root = DATA.failedAirway.root;

    let html = "";

    // Root node
    html += `<div class="flow-step expanded">
      <div class="fs-title">🔴 ${root.question}</div>
    </div>`;
    html += `<div class="flow-arrow">↓</div>`;

    // First branch: Can oxygenate?
    const child = root.children[0];
    html += `<div class="tree-node">
      <div class="tree-question">${child.question}</div>
      <div class="flow-branch">
        <div class="branch-yes" id="faYes">✅ YES<br><small>${child.yes.action}</small></div>
        <div class="branch-no" id="faNo">❌ NO<br><small>${child.no.action}</small></div>
      </div>
    </div>`;

    // YES path (hidden initially)
    html += `<div id="faYesPath" style="display:none">
      <div class="tree-outcome green">
        <strong>${child.yes.label}</strong><br>
        ${child.yes.action}
      </div>`;
    for (const step of child.yes.steps) {
      html += `<div class="flow-step"><div class="fs-detail" style="display:block">✅ ${step}</div></div>`;
    }
    html += `</div>`;

    // NO path (hidden initially)
    html += `<div id="faNoPath" style="display:none">
      <div class="tree-outcome red">
        <strong>${child.no.label}</strong><br>
        ${child.no.action}
      </div>`;

    // Equipment checklist
    if (child.no.checklist) {
      html += `<div class="checklist-gate" style="border-color:var(--red)">
        <h3>🔪 CICO Equipment Checklist</h3>`;
      for (const item of child.no.checklist) {
        html += `<div class="checklist-item" data-fa-check="${item.id}">
          <div class="checklist-check"></div>
          <span class="checklist-label">${item.label}</span>
        </div>`;
      }
      html += `</div>`;
    }

    // Procedure steps
    for (const step of child.no.steps) {
      html += `<div class="flow-step">
        <div class="fs-detail" style="display:block">🔪 ${step}</div>
      </div>`;
    }
    html += `</div>`;

    flow.innerHTML = html;

    // Branch click handlers
    const yesBtn = flow.querySelector("#faYes");
    const noBtn = flow.querySelector("#faNo");
    const yesPath = flow.querySelector("#faYesPath");
    const noPath = flow.querySelector("#faNoPath");

    yesBtn?.addEventListener("click", () => {
      yesBtn.style.borderColor = "var(--green)";
      yesBtn.style.background = "rgba(102,187,106,.2)";
      yesPath.style.display = "block";
      noPath.style.display = "none";
      noBtn.style.borderColor = "";
      noBtn.style.background = "";
      RSI.timestamp("Failed airway: Can oxygenate — SGA strategy");
    });

    noBtn?.addEventListener("click", () => {
      noBtn.style.borderColor = "var(--red)";
      noBtn.style.background = "rgba(255,82,82,.2)";
      noPath.style.display = "block";
      yesPath.style.display = "none";
      yesBtn.style.borderColor = "";
      yesBtn.style.background = "";
      RSI.timestamp("Failed airway: CICO — surgical cricothyrotomy");
    });

    // Checklist clicks in CICO path
    flow.querySelectorAll("[data-fa-check]").forEach((el) => {
      el.addEventListener("click", () => {
        el.classList.toggle("checked");
        const check = el.querySelector(".checklist-check");
        check.textContent = el.classList.contains("checked") ? "✓" : "";
      });
    });
  }

  /* ========== CRICOTHYROTOMY ========== */
  function bindCric() {
    let cricStarted = false;
    let cricStart = null;
    let cricTimer = null;

    $("#cricStart")?.addEventListener("click", () => {
      if (cricStarted) return;
      cricStarted = true;
      cricStart = Date.now();
      $("#cricStart").textContent = "RUNNING";
      $("#cricStart").disabled = true;
      RSI.timestamp("Cricothyrotomy started");
      Voice.speak("Cricothyrotomy timer started");

      cricTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - cricStart) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const s = String(elapsed % 60).padStart(2, "0");
        $("#cricClock").textContent = `${m}:${s}`;
      }, 1000);
    });

    // Render cric flow
    const flow = $("#cricFlow");
    if (flow) {
      const steps = [
        { title: "Position", detail: "Extend neck (unless C-spine injury). Identify cricothyroid membrane by palpation." },
        { title: "Stabilize", detail: "Non-dominant hand stabilizes larynx. Thumb and middle finger on thyroid cartilage." },
        { title: "Incision", detail: "Horizontal skin incision through skin and cricothyroid membrane with #10 or #20 blade." },
        { title: "Dilate", detail: "Spread with tracheal hook or forceps. Or use bougie-guided technique." },
        { title: "Insert tube", detail: "Insert 6.0 cuffed ETT or tracheostomy tube. Inflate cuff." },
        { title: "Confirm", detail: "Confirm placement with ETCO₂ waveform. Connect to ventilator." },
        { title: "Secure", detail: "Secure tube. Document procedure. Prepare for definitive airway." },
      ];

      flow.innerHTML = steps.map((s, i) => `
        <div class="flow-step" data-cric-step="${i}">
          <div class="fs-title">${i + 1}. ${s.title}</div>
          <div class="fs-detail">${s.detail}</div>
        </div>
        ${i < steps.length - 1 ? '<div class="flow-connector"></div>' : ""}
      `).join("");

      flow.querySelectorAll("[data-cric-step]").forEach((el) => {
        el.addEventListener("click", () => {
          el.classList.toggle("expanded");
          const detail = el.querySelector(".fs-detail");
          detail.style.display = el.classList.contains("expanded") ? "block" : "none";
          RSI.timestamp(`Cric step: ${el.querySelector(".fs-title").textContent}`);
        });
      });
    }
  }

  /* ========== VENTILATOR PRESETS ========== */
  function bindVentilatorScreen() {}

  function renderVentilatorGrid() {
    const grid = $("#ventGrid");
    const detail = $("#ventDetail");
    if (!grid) return;

    grid.innerHTML = DATA.ventilatorPresets.map((p) => `
      <div class="vent-card" data-vent="${p.id}">
        <div class="vent-title">${p.name}</div>
        <div class="vent-subtitle">${p.subtitle}</div>
      </div>
    `).join("");

    grid.querySelectorAll("[data-vent]").forEach((el) => {
      el.addEventListener("click", () => {
        const preset = DATA.ventilatorPresets.find((p) => p.id === el.dataset.vent);
        let html = `<h3>${preset.name} — Ventilator Settings</h3>`;
        html += `<div class="vent-params">`;
        for (const [k, v] of Object.entries(preset.params)) {
          html += `<dt>${k.replace(/_/g, " ").toUpperCase()}</dt><dd>${v}</dd>`;
        }
        html += `</div>`;
        if (preset.notes) html += `<p class="note" style="margin-top:12px">${preset.notes}</p>`;
        html += `<button class="act ghost" style="margin-top:12px" onclick="document.getElementById('ventDetail').hidden=true">Close</button>`;
        detail.innerHTML = html;
        detail.hidden = false;
      });
    });
  }

  /* ========== AIRWAY CALCULATORS ========== */
  function bindCalculatorsScreen() {
    // IBW
    const hInput = $("#cHeight");
    const sSelect = $("#cSex");
    const calcIBW = () => {
      const h = parseFloat(hInput?.value);
      if (!h) { $("#cIBWOut").textContent = "—"; return; }
      const ibw = Calc.ibw(h, sSelect.value);
      $("#cIBWOut").textContent = `IBW: ${ibw.toFixed(1)} kg`;
    };
    hInput?.addEventListener("input", calcIBW);
    sSelect?.addEventListener("change", calcIBW);

    // Tube size
    const ageInput = $("#cAge");
    const calcTube = () => {
      const age = ageInput.value === "" ? null : parseFloat(ageInput.value);
      const result = Calc.tubeSize(age, "adult");
      if (result.uncuffed) {
        $("#cTubeOut").innerHTML = `Uncuffed: ${result.uncuffed} mm &nbsp; Cuffed: ${result.cuffed} mm &nbsp; Depth: ${result.depth} cm<br><small style="color:var(--text-muted)">${result.note}</small>`;
      } else {
        $("#cTubeOut").textContent = `ETT: ${result.size} mm — Depth: ${result.depth} cm`;
      }
    };
    ageInput?.addEventListener("input", calcTube);

    // LMA
    const lmaInput = $("#cLmaWeight");
    const calcLMA = () => {
      const w = parseFloat(lmaInput?.value);
      if (!w) { $("#cLmaOut").textContent = "—"; return; }
      const lma = Calc.lmaSize(w);
      $("#cLmaOut").textContent = `LMA size: ${lma.size} (weight: ${lma.weight})`;
    };
    lmaInput?.addEventListener("input", calcLMA);

    // LEMON
    renderLEMONCalculator();

    // Shock index
    const hrInput = $("#cHR");
    const sbpInput = $("#cSBP");
    const dbpInput = $("#cDBP");
    const calcShock = () => {
      const hr = parseFloat(hrInput?.value);
      const sbp = parseFloat(sbpInput?.value);
      const dbp = parseFloat(dbpInput?.value);
      if (!hr || !sbp || !dbp) { $("#cShockOut").textContent = "—"; return; }
      const result = Calc.shockIndex(hr, sbp, dbp);
      $("#cShockOut").innerHTML = `SI: <strong>${result.si}</strong> &nbsp; MAP: <strong>${result.map}</strong> mmHg<br><small>${result.interpretation}</small>`;
    };
    hrInput?.addEventListener("input", calcShock);
    sbpInput?.addEventListener("input", calcShock);
    dbpInput?.addEventListener("input", calcShock);

    // Vasopressor rates
    renderPressorCalculator();
  }

  function renderLEMONCalculator() {
    const container = $("#cDASFlags");
    if (!container) return;

    const allCriteria = [
      ...DATA.lemon.external,
      ...DATA.lemon.look,
      ...DATA.lemon.evaluate_3_3,
      ...DATA.lemon.mallampati,
      ...DATA.lemon.neck,
      ...DATA.lemon.obstruction,
    ];

    container.innerHTML = allCriteria.map((c) =>
      `<label><input type="checkbox" value="${c.id}"> ${c.label}</label>`
    ).join("");

    const updateScore = () => {
      const flags = [];
      container.querySelectorAll("input:checked").forEach((cb) => flags.push(cb.value));
      const result = Calc.lemonScore(flags);

      let colorClass = result.risk.color;
      let html = `<div class="lemon-score-display ${colorClass}">
        <div class="lemon-score-num">${result.score}</div>
        <div>
          <div class="lemon-score-label">${result.risk.label}</div>
          <div class="lemon-score-rec">${result.risk.rec}</div>
        </div>
      </div>`;
      $("#cDASOut").innerHTML = html;
    };

    container.querySelectorAll("input").forEach((cb) => cb.addEventListener("change", updateScore));
    updateScore();
  }

  function renderPressorCalculator() {
    const chipContainer = $("#cPressorChips");
    if (!chipContainer) return;

    chipContainer.innerHTML = DATA.vasopressors.map((v) =>
      `<div class="chip" data-pressor="${v.id}">${v.name}</div>`
    ).join("");

    let selectedPressor = DATA.vasopressors[0];
    chipContainer.querySelector(`[data-pressor="${selectedPressor.id}"]`)?.classList.add("active");

    chipContainer.querySelectorAll("[data-pressor]").forEach((el) => {
      el.addEventListener("click", () => {
        chipContainer.querySelectorAll("[data-pressor]").forEach((c) => c.classList.remove("active"));
        el.classList.add("active");
        selectedPressor = DATA.vasopressors.find((v) => v.id === el.dataset.pressor);
        calcPressor();
      });
    });

    const calcPressor = () => {
      const weight = parseFloat($("#cPressorWeight")?.value);
      const conc = parseFloat($("#cPressorConc")?.value) || selectedPressor.conc;
      if (!weight) { $("#cPressorOut").textContent = "—"; return; }

      let html = `<strong>${selectedPressor.name}</strong> ${selectedPressor.defaultConc ? `(${selectedPressor.defaultConc})` : ""}<br>`;
      for (const rate of selectedPressor.rates) {
        const mlHr = Calc.pressorRate(rate.dose, weight, conc);
        html += `${rate.label} (${rate.dose} mcg/kg/min): <strong>${mlHr} mL/hr</strong><br>`;
      }
      $("#cPressorOut").innerHTML = html;
    };

    $("#cPressorWeight")?.addEventListener("input", calcPressor);
    $("#cPressorConc")?.addEventListener("input", calcPressor);
  }

  /* ========== CASE REPORTS ========== */
  function bindReports() {
    $("#reportCopy")?.addEventListener("click", () => {
      const text = $("#reportOut")?.textContent;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          $("#reportCopy").textContent = "Copied!";
          setTimeout(() => { $("#reportCopy").textContent = "Copy"; }, 2000);
        });
      }
    });

    $("#reportPrint")?.addEventListener("click", () => window.print());
  }

  async function renderReports() {
    const state = RSI.getState();
    const out = $("#reportOut");
    if (!out) return;

    // Generate report
    const now = new Date();
    let report = `RAPID SEQUENCE INTUBATION — PROCEDURE REPORT\n`;
    report += `${"═".repeat(50)}\n\n`;

    report += `Date: ${now.toLocaleDateString("en-GB")}\n`;
    report += `Time: ${now.toLocaleTimeString("en-GB")}\n`;
    report += `Mode: ${state.mode === "adult" ? "Adult" : "Pediatric"} RSI\n\n`;

    // Indication
    report += `INDICATION\n`;
    report += `  ${fields.indication || "(not recorded)"}\n\n`;

    // Airway assessment
    report += `AIRWAY ASSESSMENT\n`;
    const lemonResult = Calc.lemonScore(state.lemonFlags || []);
    report += `  LEMON Score: ${lemonResult.score} — ${lemonResult.risk.label}\n`;
    report += `  Recommendation: ${lemonResult.risk.rec}\n\n`;

    // Pre-oxygenation
    report += `PRE-OXYGENATION\n`;
    report += `  ${fields.decision_preoxygenation || "Standard 3-min 100% O₂"}\n\n`;

    // Drugs
    report += `DRUGS ADMINISTERED\n`;
    if (state.drugRecord.length > 0) {
      for (const d of state.drugRecord) {
        report += `  ${d.name} ${d.dose}${d.unit}\n`;
      }
    } else {
      report += `  (none recorded)\n`;
    }
    report += `\n`;

    // Timeline
    report += `TIMELINE\n`;
    if (state.timeline.length > 0) {
      for (const t of state.timeline) {
        report += `  ${t.clock}  ${t.event}\n`;
      }
    } else {
      report += `  (no events recorded)\n`;
    }
    report += `\n`;

    // Attempts
    report += `LARYNGOSCOPY ATTEMPTS\n`;
    report += `  Total attempts: ${state.attempts.length}\n`;
    for (const a of state.attempts) {
      const dur = Math.round(a.durationMs / 1000);
      report += `  Attempt ${a.attempt}: ${dur}s`;
      if (a.clGrade) report += ` — CL Grade ${a.clGrade}`;
      report += `\n`;
    }
    report += `\n`;

    // Cormack-Lehane
    if (fields.cl_grade) {
      report += `CORMACK-LEHANE GRADE: ${fields.cl_grade}\n`;
      if (fields.view_pct) report += `POGO: ${fields.view_pct}%\n`;
      report += `\n`;
    }

    // Bougie
    report += `BOUGIE: ${fields.bougie_used ? "Yes" : "No"}\n\n`;

    // Tube details
    report += `TUBE DETAILS\n`;
    if (fields.ett_size) report += `  ETT size: ${fields.ett_size} mm\n`;
    if (fields.ett_depth) report += `  Depth at teeth: ${fields.ett_depth} cm\n`;
    report += `\n`;

    // Confirmation
    report += `TUBE CONFIRMATION\n`;
    const confirmed = Object.entries(state.tubeConfirmed || {}).filter(([k, v]) => v);
    if (confirmed.length > 0) {
      for (const [id] of confirmed) {
        const item = DATA.tubeConfirmation.find((t) => t.id === id);
        if (item) report += `  ✓ ${item.label}\n`;
      }
    } else {
      report += `  (not recorded)\n`;
    }
    report += `\n`;

    // Complications
    report += `COMPLICATIONS\n`;
    report += `  ${fields.complications || "None recorded"}\n\n`;

    // Operator & Assistant
    report += `OPERATOR: ${fields.operator || "(not recorded)"}\n`;
    report += `ASSISTANT: ${fields.assistant || "(not recorded)"}\n\n`;

    // Ventilator
    if (fields.ventilatorPreset) {
      const preset = DATA.ventilatorPresets.find((p) => p.id === fields.ventilatorPreset);
      if (preset) {
        report += `VENTILATOR PRESET: ${preset.name}\n`;
        for (const [k, v] of Object.entries(preset.params)) {
          report += `  ${k.replace(/_/g, " ").toUpperCase()}: ${v}\n`;
        }
        report += `\n`;
      }
    }

    // Sedation
    report += `POST-INTUBATION SEDATION\n`;
    report += `  ${fields.sedation || "Per protocol"}\n\n`;

    report += `${"═".repeat(50)}\n`;
    report += `Generated by ER Airway Assistant v2.0\n`;
    report += `This is a clinical reference tool — verify against institutional protocol.\n`;

    out.textContent = report;

    // Save case
    const saveBtn = document.createElement("button");
    saveBtn.className = "act";
    saveBtn.textContent = "Save Case";
    saveBtn.addEventListener("click", async () => {
      await Store.saveCase({
        date: now.toISOString(),
        mode: state.mode,
        report,
        timeline: state.timeline,
        attempts: state.attempts,
        drugs: state.drugRecord,
      });
      saveBtn.textContent = "Saved!";
      setTimeout(() => { saveBtn.textContent = "Save Case"; }, 2000);
      renderSavedCases();
    });

    const btnRow = out.parentElement?.querySelector(".btnrow");
    if (btnRow && !btnRow.querySelector(".act.save-case")) {
      saveBtn.classList.add("save-case");
      btnRow.prepend(saveBtn);
    }

    renderSavedCases();
  }

  async function renderSavedCases() {
    const list = $("#savedCasesList");
    if (!list) return;
    const cases = await Store.listCases();
    if (cases.length === 0) {
      list.innerHTML = '<p class="note">No saved cases yet.</p>';
      return;
    }
    list.innerHTML = cases.map((c) => `
      <div class="case-item">
        <div>
          <strong>${c.mode === "adult" ? "Adult" : "Pediatric"} RSI</strong><br>
          <span class="case-date">${new Date(c.date).toLocaleString("en-GB")}</span>
        </div>
        <div>
          <button class="act ghost" data-view-case="${c.id}">View</button>
          <button class="act ghost" data-del-case="${c.id}" style="color:var(--red)">✕</button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll("[data-view-case]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = cases.find((x) => x.id === btn.dataset.viewCase);
        if (c) {
          $("#reportOut").textContent = c.report;
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    list.querySelectorAll("[data-del-case]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm("Delete this case?")) {
          await Store.deleteCase(btn.dataset.delCase);
          renderSavedCases();
        }
      });
    });
  }

  /* ---- Public API ---- */
  return { boot, navigateTo };
})();

/* ---- Start ---- */
document.addEventListener("DOMContentLoaded", () => App.boot());
