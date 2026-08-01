/* ==========================================================================
   RSI.JS — RSI workflow engine: branching, checklist gate, timestamps, drugs
   ========================================================================== */

"use strict";

const RSI = (() => {
  let mode = "adult";       // "adult" | "child"
  let steps = [];
  let idx = 0;
  let startTime = null;
  let clockInterval = null;
  let attemptTimer = null;
  let attemptStart = null;
  let attempts = [];         // { attempt, start, end, clGrade, viewPct, bougie, ettSize, ettDepth }
  let currentAttempt = null;
  let timeline = [];         // { time, event }
  let drugRecord = [];       // { name, dose, unit, time }
  let checklistState = {};   // { id: true/false }
  let lemonFlags = [];
  let tubeConfirmed = {};    // { id: true }
  let fields = {};           // { fieldId: value }
  let completed = false;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  /* ---- Lifecycle ---- */
  function init(m) {
    mode = m;
    steps = DATA.rsiSteps[m];
    idx = 0;
    startTime = null;
    clearInterval(clockInterval);
    clearInterval(attemptTimer);
    attemptTimer = null;
    attemptStart = null;
    attempts = [];
    currentAttempt = null;
    timeline = [];
    drugRecord = [];
    checklistState = {};
    lemonFlags = [];
    tubeConfirmed = {};
    fields = {};
    completed = false;

    $("#rsiClock").textContent = "00:00";
    $("#rsiDelta").textContent = "";
    render();
  }

  function getState() {
    return { mode, steps, idx, startTime, attempts, timeline, drugRecord, checklistState, lemonFlags, tubeConfirmed, fields, completed };
  }

  /* ---- Timer ---- */
  function startTimer() {
    startTime = Date.now();
    clockInterval = setInterval(tick, 1000);
    tick();
  }
  function tick() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    $("#rsiClock").textContent = `${m}:${s}`;
  }
  function timestamp(event) {
    const now = new Date();
    const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    timeline.push({
      time: `${m}:${s}`,
      clock: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      event,
    });
    renderTimeline();
  }

  /* ---- Attempt tracking ---- */
  function startAttempt() {
    attemptStart = Date.now();
    const attemptNum = attempts.length + 1;
    currentAttempt = { attempt: attemptNum, start: new Date().toISOString() };
    timestamp(`Laryngoscopy attempt ${attemptNum} started`);
    // start 30-second timer
    if (attemptTimer) clearInterval(attemptTimer);
    const timerEl = $("#rsiAttemptTimer");
    if (timerEl) {
      let sec = 0;
      attemptTimer = setInterval(() => {
        sec++;
        timerEl.textContent = `${sec}s`;
        if (sec >= 30) timerEl.style.color = "var(--red)";
        else timerEl.style.color = "var(--accent)";
      }, 1000);
    }
  }

  function endAttempt() {
    if (attemptTimer) { clearInterval(attemptTimer); attemptTimer = null; }
    if (currentAttempt) {
      currentAttempt.end = new Date().toISOString();
      currentAttempt.durationMs = Date.now() - attemptStart;
      attempts.push(currentAttempt);
      timestamp(`Laryngoscopy attempt ${currentAttempt.attempt} ended (${Math.round(currentAttempt.durationMs / 1000)}s)`);
      currentAttempt = null;
    }
  }

  /* ---- Checklist gate ---- */
  function renderChecklist() {
    const body = $("#rsiStepBody");
    const allChecked = DATA.preRSIChecklist.every((item) => checklistState[item.id]);

    let html = `<div class="checklist-gate">
      <h3>🔒 Airway Checklist — Challenge & Response</h3>`;

    for (const item of DATA.preRSIChecklist) {
      const checked = checklistState[item.id];
      html += `
        <div class="checklist-item ${checked ? "checked" : ""}" data-checklist="${item.id}">
          <div class="checklist-check">${checked ? "✓" : ""}</div>
          <span class="checklist-label">${item.icon} ${item.label}</span>
        </div>`;
    }

    if (!allChecked) {
      html += `<div class="checklist-gate-locked">⚠ All items must be checked before proceeding</div>`;
    }
    html += `</div>`;
    body.innerHTML = html;

    // Bind clicks
    body.querySelectorAll("[data-checklist]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.checklist;
        checklistState[id] = !checklistState[id];
        if (checklistState[id]) timestamp(`Checklist: ${DATA.preRSIChecklist.find((c) => c.id === id).label}`);
        renderChecklist();
      });
    });

    // Enable/disable next button
    $("#rsiNext").disabled = !allChecked;
    if (allChecked) {
      Voice.speak("All checklist items confirmed. You may proceed.");
      timestamp("Airway checklist completed — all items confirmed");
      startTimer();
    }
  }

  /* ---- Decision branch rendering ---- */
  function renderDecision(step) {
    const body = $("#rsiStepBody");
    const dec = step.decision;
    let html = `<div class="card"><p>${step.content}</p></div>`;
    html += `<div class="tree-node">
      <div class="tree-question">${dec.question}</div>
      <div class="tree-options">
        <div class="tree-option" data-decision="yes">
          ✅ ${dec.yes.label}
          <span class="tree-arrow">→</span>
        </div>
        <div class="tree-option" data-decision="no">
          ❌ ${dec.no.label}
          <span class="tree-arrow">↓</span>
        </div>
      </div>
    </div>`;

    // Branch options (hidden until NO selected)
    html += `<div id="rsiBranches" style="display:none">`;
    for (const branch of dec.no.branches) {
      html += `<div class="tree-option" data-branch="${branch.id}">
        🔀 ${branch.label}
        ${branch.note ? `<br><small style="color:var(--text-dim)">${branch.note}</small>` : ""}
        <span class="tree-arrow">→</span>
      </div>`;
    }
    html += `</div>`;
    body.innerHTML = html;

    let selectedDecision = null;

    body.querySelectorAll("[data-decision]").forEach((el) => {
      el.addEventListener("click", () => {
        body.querySelectorAll("[data-decision]").forEach((e) => e.classList.remove("selected"));
        el.classList.add("selected");
        selectedDecision = el.dataset.decision;

        if (selectedDecision === "yes") {
          timestamp("Decision: adequate — continuing RSI");
          $("#rsiBranches").style.display = "none";
          fields[`decision_${step.id}`] = "adequate";
          // Auto-advance
          setTimeout(() => next(), 400);
        } else {
          $("#rsiBranches").style.display = "block";
          timestamp("Decision: inadequate — branching");
        }
      });
    });

    body.querySelectorAll("[data-branch]").forEach((el) => {
      el.addEventListener("click", () => {
        body.querySelectorAll("[data-branch]").forEach((e) => e.classList.remove("selected"));
        el.classList.add("selected");
        const branchId = el.dataset.branch;
        const branch = dec.no.branches.find((b) => b.id === branchId);
        timestamp(`Branch selected: ${branch.label}`);
        fields[`decision_${step.id}`] = branchId;
        // Auto-advance
        setTimeout(() => next(), 400);
      });
    });
  }

  /* ---- Drug choice rendering ---- */
  function renderDrugChoice(step) {
    const body = $("#rsiStepBody");
    let html = `<div class="card"><p>${step.content}</p></div>`;

    for (const drugGroup of step.drugSequence) {
      const group = DATA.drugs[drugGroup];
      if (!group) continue;
      html += `<div class="card"><h3>${group.label}</h3><div class="chiprow" data-group="${drugGroup}">`;
      for (const agent of group.agents) {
        const selected = drugRecord.find((d) => d.agentId === agent.id);
        html += `<div class="chip ${selected ? "active" : ""}" data-drug="${agent.id}">${agent.name}</div>`;
      }
      html += `</div><div id="drugDetail_${drugGroup}" class="drug-detail-container"></div></div>`;
    }

    html += `<div class="card">
      <div class="weight-row">
        <label>Patient weight</label>
        <input type="number" id="rsiWeight" min="0" step="0.1" placeholder="kg" value="${fields.weight || ""}">
        <span>kg</span>
      </div>
    </div>`;

    body.innerHTML = html;

    // Bind drug chip clicks
    body.querySelectorAll("[data-drug]").forEach((el) => {
      el.addEventListener("click", () => {
        const agentId = el.dataset.drug;
        const groupKey = el.closest("[data-group]").dataset.group;
        const group = DATA.drugs[groupKey];
        const agent = group.agents.find((a) => a.id === agentId);

        // Toggle active
        el.closest(".chiprow").querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        el.classList.add("active");

        // Show detail
        const weight = parseFloat($("#rsiWeight")?.value) || 70;
        const cat = fields.patientCategory || "adult";
        let doseVal = null;
        if (agent.dosePerKg) {
          const dosePerKg = cat === "pediatric" || cat === "neonate" ? (agent.dosePerKg.child || agent.dosePerKg.adult) : agent.dosePerKg.adult;
          doseVal = Calc.drugDose(dosePerKg, weight, agent.maxDose, agent.minDose);
        }

        let detail = `<div class="drug-header"><span class="drug-name">${agent.name}</span>`;
        if (doseVal !== null) detail += `<span class="drug-dose">${doseVal} ${agent.unit}</span>`;
        detail += `</div><dl class="drug-meta">`;
        if (agent.onset) detail += `<dt>Onset</dt><dd>${agent.onset}</dd>`;
        if (agent.duration) detail += `<dd>Duration</dd><dd>${agent.duration}</dd>`;
        if (agent.route) detail += `<dt>Route</dt><dd>${agent.route}</dd>`;
        if (agent.dosePerKg) detail += `<dt>Dose</dt><dd>${agent.dosePerKg.adult} ${agent.unit}/kg (adult)</dd>`;
        if (doseVal !== null) detail += `<dt>Calculated</dt><dd>${doseVal} ${agent.unit} for ${weight} kg</dd>`;
        detail += `</dl>`;

        if (agent.contraindications?.length) {
          detail += `<div class="drug-warn"><strong>Avoid in:</strong><br>${agent.contraindications.join("<br>")}</div>`;
        }
        if (agent.warnings) {
          detail += `<div class="drug-warn" style="margin-top:6px;background:var(--amber-bg);border-color:rgba(255,183,77,.2);color:var(--amber)">${agent.warnings}</div>`;
        }

        document.getElementById(`drugDetail_${groupKey}`).innerHTML = detail;

        // Record drug
        drugRecord = drugRecord.filter((d) => d.group !== groupKey);
        drugRecord.push({
          group: groupKey,
          agentId: agent.id,
          name: agent.name,
          dose: doseVal,
          unit: agent.unit,
          time: new Date().toISOString(),
        });
        timestamp(`${agent.name} ${doseVal}${agent.unit} administered`);
        Voice.speak(`${agent.name} ${doseVal} ${agent.unit} pushed`);
      });
    });

    // Weight input
    const weightInput = $("#rsiWeight");
    if (weightInput) {
      weightInput.addEventListener("input", () => {
        fields.weight = weightInput.value;
      });
    }
  }

  /* ---- Attempt tracking UI ---- */
  function renderAttemptTracking(step) {
    const body = $("#rsiStepBody");
    let html = `<div class="card"><p>${step.content}</p></div>`;

    // Attempt counter
    html += `<div class="attempt-counter">
      <span class="ac-label">Attempt</span>
      <span class="ac-num">${attempts.length + 1}</span>
      <span id="rsiAttemptTimer" style="font-family:var(--font-mono);font-size:1.1rem;margin-left:auto">0s</span>
    </div>`;

    // Fields
    if (step.fields) {
      html += `<div class="card">`;
      for (const field of step.fields) {
        if (field.type === "select") {
          html += `<div class="info-row">
            <span class="info-label">${field.label}</span>
            <select data-field="${field.id}" style="width:auto;padding:6px 10px">
              <option value="">—</option>
              ${field.options.map((o) => `<option value="${o}" ${fields[field.id] === o ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>`;
        } else if (field.type === "number") {
          html += `<div class="info-row">
            <span class="info-label">${field.label}</span>
            <input type="number" data-field="${field.id}" placeholder="—" value="${fields[field.id] || ""}" style="width:80px;padding:6px 10px">
            ${field.suffix ? `<span>${field.suffix}</span>` : ""}
          </div>`;
        } else if (field.type === "toggle") {
          html += `<div class="confirm-step ${fields[field.id] ? "done" : ""}" data-toggle-field="${field.id}">
            <div class="cs-num">${fields[field.id] ? "✓" : ""}</div>
            <span class="cs-text">${field.label}</span>
          </div>`;
        }
      }
      html += `</div>`;
    }

    // Previous attempts summary
    if (attempts.length > 0) {
      html += `<div class="card"><h3>Previous Attempts</h3>`;
      for (const a of attempts) {
        const dur = Math.round(a.durationMs / 1000);
        html += `<div class="info-row">
          <span class="info-label">Attempt ${a.attempt}</span>
          <span class="info-value">${dur}s ${a.clGrade ? `— CL ${a.clGrade}` : ""}</span>
        </div>`;
      }
      html += `</div>`;
    }

    html += `<div class="bigbtns">
      <button id="attemptStartBtn" class="bigbtn primary">START ATTEMPT</button>
      <button id="attemptEndBtn" class="bigbtn ghost" ${!currentAttempt ? "disabled" : ""}>END ATTEMPT</button>
    </div>`;

    body.innerHTML = html;

    // Bindings
    const startBtn = $("#attemptStartBtn");
    const endBtn = $("#attemptEndBtn");
    if (startBtn) startBtn.addEventListener("click", () => { startAttempt(); renderAttemptTracking(step); });
    if (endBtn) endBtn.addEventListener("click", () => {
      endAttempt();
      // Save field values
      if (step.fields) {
        for (const field of step.fields) {
          const el = body.querySelector(`[data-field="${field.id}"]`);
          if (el) fields[field.id] = el.value;
        }
      }
      renderAttemptTracking(step);
    });

    // Field bindings
    body.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("change", () => { fields[el.dataset.field] = el.value; });
    });
    body.querySelectorAll("[data-toggle-field]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.toggleField;
        fields[id] = !fields[id];
        renderAttemptTracking(step);
      });
    });
  }

  /* ---- Tube confirmation rendering ---- */
  function renderTubeConfirmation(step) {
    const body = $("#rsiStepBody");
    let html = `<div class="card"><p>${step.content}</p></div>`;
    html += `<div class="card">`;

    for (const item of step.confirmSteps) {
      const done = tubeConfirmed[item.id];
      html += `<div class="confirm-step ${done ? "done" : ""}" data-confirm="${item.id}">
        <div class="cs-num">${done ? "✓" : ""}</div>
        <span class="cs-text">${item.primary ? "📈 " : ""}${item.label}${item.primary ? " <strong>(GOLD STANDARD)</strong>" : ""}</span>
      </div>`;
    }
    html += `</div>`;

    // Check if ETCO2 confirmed
    const etco2Done = tubeConfirmed["etco2"];
    if (etco2Done) {
      html += `<div class="tree-outcome green">✓ ETCO₂ confirmed — tube is in correct position</div>`;
    }

    body.innerHTML = html;

    body.querySelectorAll("[data-confirm]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.confirm;
        tubeConfirmed[id] = !tubeConfirmed[id];
        if (tubeConfirmed[id]) {
          const item = step.confirmSteps.find((c) => c.id === id);
          timestamp(`Confirmation: ${item.label}`);
        }
        renderTubeConfirmation(step);
      });
    });
  }

  /* ---- Post-intubation rendering ---- */
  function renderPostIntubation(step) {
    const body = $("#rsiStepBody");
    let html = `<div class="card"><p>${step.content}</p></div>`;

    // Summary of procedure so far
    const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");

    html += `<div class="card">
      <h3>Procedure Summary</h3>
      <div class="info-row"><span class="info-label">Total time</span><span class="info-value">${m}:${s}</span></div>
      <div class="info-row"><span class="info-label">Attempts</span><span class="info-value">${attempts.length}</span></div>
      ${fields.cl_grade ? `<div class="info-row"><span class="info-label">Cormack-Lehane</span><span class="info-value">Grade ${fields.cl_grade}</span></div>` : ""}
      ${fields.ett_size ? `<div class="info-row"><span class="info-label">ETT size</span><span class="info-value">${fields.ett_size} mm</span></div>` : ""}
      ${fields.ett_depth ? `<div class="info-row"><span class="info-label">ETT depth</span><span class="info-value">${fields.ett_depth} cm</span></div>` : ""}
      ${fields.bougie_used ? `<div class="info-row"><span class="info-label">Bougie</span><span class="info-value">Used</span></div>` : ""}
    </div>`;

    // Drug summary
    if (drugRecord.length > 0) {
      html += `<div class="card"><h3>Drugs Given</h3>`;
      for (const d of drugRecord) {
        html += `<div class="info-row"><span class="info-label">${d.name}</span><span class="info-value">${d.dose}${d.unit}</span></div>`;
      }
      html += `</div>`;
    }

    html += `<div class="bigbtns">
      <button id="rsiCompleteBtn" class="bigbtn primary">COMPLETE & GENERATE REPORT</button>
    </div>`;

    body.innerHTML = html;

    $("#rsiCompleteBtn")?.addEventListener("click", () => {
      completed = true;
      timestamp("RSI procedure completed");
      Voice.speak("RSI procedure completed. Report generated.");
      // Navigate to reports
      if (typeof App !== "undefined" && App.navigateTo) {
        App.navigateTo("reports");
      }
    });
  }

  /* ---- Ventilator presets for post-intubation ---- */
  function renderVentilatorStep() {
    const body = $("#rsiStepBody");
    let html = `<div class="card">
      <h3>Quick Ventilator Setup</h3>
      <p class="note">Select a preset or configure manually</p>
      <div class="chiprow" style="margin-top:10px">`;
    for (const preset of DATA.ventilatorPresets) {
      html += `<div class="chip" data-vent-preset="${preset.id}">${preset.name}</div>`;
    }
    html += `</div><div id="ventPresetDetail"></div></div>`;
    body.innerHTML = html;

    body.querySelectorAll("[data-vent-preset]").forEach((el) => {
      el.addEventListener("click", () => {
        body.querySelectorAll("[data-vent-preset]").forEach((c) => c.classList.remove("active"));
        el.classList.add("active");
        const preset = DATA.ventilatorPresets.find((p) => p.id === el.dataset.ventPreset);
        let detail = `<div style="margin-top:12px">`;
        detail += `<div class="vent-params">`;
        for (const [k, v] of Object.entries(preset.params)) {
          detail += `<dt>${k.replace(/_/g, " ").toUpperCase()}</dt><dd>${v}</dd>`;
        }
        detail += `</div>`;
        if (preset.notes) detail += `<p class="note" style="margin-top:10px">${preset.notes}</p>`;
        detail += `</div>`;
        document.getElementById("ventPresetDetail").innerHTML = detail;
        fields.ventilatorPreset = preset.id;
        timestamp(`Ventilator preset: ${preset.name}`);
      });
    });
  }

  /* ---- Main render ---- */
  function render() {
    const step = steps[idx];
    if (!step) return;

    // Update header
    $("#rsiStepName").textContent = step.name;
    $("#rsiNextName").textContent = idx < steps.length - 1 ? steps[idx + 1].name : "Complete";
    const pct = ((idx) / (steps.length - 1)) * 100;
    $("#rsiProgressFill").style.width = `${pct}%`;

    // Back button
    $("#rsiBack").disabled = idx === 0;

    // Route to appropriate renderer
    if (step.checklist) {
      renderChecklist();
    } else if (step.decision) {
      renderDecision(step);
    } else if (step.drugChoice) {
      renderDrugChoice(step);
    } else if (step.attemptTracking) {
      renderAttemptTracking(step);
    } else if (step.confirmSteps) {
      renderTubeConfirmation(step);
    } else if (step.postIntubation) {
      renderPostIntubation(step);
    } else if (step.timer) {
      renderTimerStep(step);
    } else {
      renderGenericStep(step);
    }

    // Update next button state
    updateNextState(step);
  }

  function renderTimerStep(step) {
    const body = $("#rsiStepBody");
    let html = `<div class="card"><p>${step.content}</p></div>`;
    html += `<div class="rsi-timerbar">
      <div class="rsi-clock" id="stepTimer">${step.timer.duration || 0}s</div>
      <button id="stepTimerStart" class="bigbtn primary small">START</button>
    </div>`;
    body.innerHTML = html;

    let remaining = step.timer.duration || 60;
    let timerRunning = false;
    const timerEl = body.querySelector("#stepTimer");
    const startBtn = body.querySelector("#stepTimerStart");

    startBtn?.addEventListener("click", () => {
      if (timerRunning) return;
      timerRunning = true;
      startBtn.disabled = true;
      startBtn.textContent = "RUNNING";
      timestamp(`Timer started: ${step.timer.label}`);
      Voice.speak(`Timer started. ${step.timer.label}`);

      const iv = setInterval(() => {
        remaining--;
        timerEl.textContent = `${remaining}s`;
        if (remaining <= 10) timerEl.style.color = "var(--red)";
        if (remaining <= 0) {
          clearInterval(iv);
          timerEl.textContent = "✓ GO";
          timerEl.style.color = "var(--green)";
          Voice.speak("Timer complete. Proceed.");
          timestamp(`Timer complete: ${step.timer.label}`);
          $("#rsiNext").disabled = false;
        }
      }, 1000);
    });
  }

  function renderGenericStep(step) {
    const body = $("#rsiStepBody");
    body.innerHTML = `<div class="card"><p>${step.content}</p></div>`;
  }

  function updateNextState(step) {
    const nextBtn = $("#rsiNext");
    if (step.checklist) {
      const allChecked = DATA.preRSIChecklist.every((item) => checklistState[item.id]);
      nextBtn.disabled = !allChecked;
    } else if (step.decision) {
      nextBtn.disabled = true; // auto-advances on selection
    } else if (step.timer) {
      nextBtn.disabled = true; // enabled when timer completes
    } else {
      nextBtn.disabled = false;
    }
  }

  /* ---- Navigation ---- */
  function next() {
    if (idx < steps.length - 1) {
      // End any active attempt
      if (currentAttempt) endAttempt();
      idx++;
      render();
    }
  }

  function back() {
    if (idx > 0) {
      idx--;
      render();
    }
  }

  /* ---- Timeline rendering ---- */
  function renderTimeline() {
    const list = $("#rsiTimelineList");
    if (!list) return;
    list.innerHTML = timeline.map((t) => `
      <div class="timeline-entry">
        <span class="tl-time">${t.time}</span>
        <span class="tl-event">${t.event}</span>
      </div>
    `).join("");
    list.scrollTop = list.scrollHeight;
  }

  /* ---- Emergency / Failed airway ---- */
  function triggerEmergency() {
    endAttempt();
    timestamp("EMERGENCY declared — navigating to failed airway");
  }

  return { init, getState, next, back, render, timestamp, triggerEmergency, renderTimeline };
})();
