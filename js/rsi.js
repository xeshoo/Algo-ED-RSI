/* ==========================================================================
   RSI.JS — drives the full-screen RSI workflow (shared adult/pediatric).
   State lives in RSI.state; render functions rebuild #rsiStepBody per step.
   Gated steps (RSI_STEPS[i].gate) block NEXT until isStepComplete() is true.
   ========================================================================== */

const RSI = {
  state: null,
  clockInt: null,

  reset(mode){
    this.state = {
      mode,                      // "adult" | "child"
      category: mode === "child" ? "child" : "adult",
      stepIndex: 0,
      caseStart: null,
      elapsed: 0,
      weightKg: null,
      ageYears: null,
      indication: "",
      lemonChecked: new Set(),
      equipChecked: new Set(),
      confirmChecked: new Set(),
      posChecked: new Set(),
      drugsGiven: [],            // {label, dose, time, elapsed}
      events: [],                // {label, wallTime, elapsed} — full timestamped audit trail
      attemptNumber: 0,
      preoxAdequate: null,       // null | true | false
      preoxPlan: null,           // "niv" | "bvm" | "dsi" chosen when inadequate
      tubeSize: null,
      tubeDepth: null,
      cormackLehane: null,
      bougieUsed: false,
      operator: "",
      assistant: "",
      complications: ""
    };
  },

  start(mode){
    this.reset(mode);
    this.state.caseStart = Date.now();
    this.logEvent("RSI started");
    clearInterval(this.clockInt);
    this.clockInt = setInterval(()=>this.tick(), 1000);
    this.renderAll();
    Voice.say(RSI_STEPS[0].voice);
  },

  tick(){
    if(!this.state) return;
    this.state.elapsed = Math.floor((Date.now()-this.state.caseStart)/1000);
    document.getElementById("rsiClock").textContent = fmtTime(this.state.elapsed);
    this.updateDelta();
  },

  updateDelta(){
    const idx = Math.min(this.state.stepIndex, IDEAL_TIMELINE.length-1);
    const target = IDEAL_TIMELINE[idx].t;
    const delta = this.state.elapsed - target;
    const el = document.getElementById("rsiDelta");
    if(delta > 5){ el.textContent = `⚠ Behind by ${delta}s`; el.classList.add("behind"); }
    else{ el.textContent = delta < -5 ? "Ahead of pace" : "On pace"; el.classList.remove("behind"); }
    this.renderTimeline();
  },

  vibrate(pattern){ if(App.settings.vibrate && navigator.vibrate) navigator.vibrate(pattern); },

  /* real wall-clock timestamped log — this feeds the documentation report */
  logEvent(label){
    if(!this.state) return;
    const wallTime = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
    this.state.events.push({ label, wallTime, elapsed:this.state.elapsed });
  },

  logDrug(label, doseText){
    this.state.drugsGiven.push({ label, dose:doseText, time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}), elapsed:this.state.elapsed });
    this.logEvent(`${label} administered — ${doseText}`);
    this.vibrate(30);
  },

  /* -------- gating: whether the current step's mandatory condition is met -------- */
  isStepComplete(step){
    const s = this.state;
    if(step.id === "equip") return EQUIPMENT_CHECKLIST.every((_,i)=>s.equipChecked.has("equip"+i));
    if(step.id === "confirm") return CONFIRMATION_CHECKLIST.every((_,i)=>s.confirmChecked.has("confirm"+i));
    return true;
  },

  goStep(delta){
    const step = RSI_STEPS[this.state.stepIndex];
    if(delta > 0 && step.gate && !this.isStepComplete(step)){
      this.vibrate([50,50,50]);
      const body = document.getElementById("rsiStepBody");
      body.classList.add("shake");
      setTimeout(()=>body.classList.remove("shake"), 400);
      return;
    }
    const next = this.state.stepIndex + delta;
    if(next < 0 || next >= RSI_STEPS.length) return;
    this.state.stepIndex = next;
    this.vibrate(40);
    Voice.say(RSI_STEPS[next].voice);
    this.logEvent(RSI_STEPS[next].label);
    this.renderAll();
  },

  jumpTo(stepId){
    const idx = RSI_STEPS.findIndex(s=>s.id===stepId);
    if(idx === -1) return;
    this.state.stepIndex = idx;
    this.renderAll();
  },

  renderAll(){
    const step = RSI_STEPS[this.state.stepIndex];
    const next = RSI_STEPS[this.state.stepIndex+1];
    document.getElementById("rsiStepName").textContent = step.label.toUpperCase();
    document.getElementById("rsiNextName").textContent = next ? next.label : "Complete";
    document.getElementById("rsiProgressFill").style.width =
      `${Math.round(((this.state.stepIndex+1)/RSI_STEPS.length)*100)}%`;
    document.getElementById("rsiBack").disabled = this.state.stepIndex === 0;
    const nextBtn = document.getElementById("rsiNext");
    nextBtn.textContent = next ? "NEXT" : "FINISH";
    nextBtn.classList.toggle("locked", step.gate && !this.isStepComplete(step));
    this.renderStepBody(step);
    this.updateDelta();
  },

  renderStepBody(step){
    const body = document.getElementById("rsiStepBody");
    const s = this.state;
    let html = "";

    if(step.id === "lemon") html += lemonHtml(s);
    else if(step.id === "equip") html += equipHtml(s);
    else if(step.id === "preox") html += preoxHtml(s);
    else if(step.id === "position") html += checklistHtml("posChk", [
        "Belt/belly height — head at/above belt level","Head of patient up to head of bed","Head of bed up 30°",
        "Ear level to sternal notch, face plane parallel to ceiling","Assistants ready (laryngeal manipulation, jaw thrust)"
      ], s.posChecked, "pos");
    else if(step.id === "induction") html += weightAgeInputsHtml(s) + categoryChipsHtml(s) +
        `<div class="card"><h3>Sedatives — tap to log administration</h3>${richDoseTableHtml(SEDATIVES, s, "induction")}</div>`;
    else if(step.id === "paralytic") html += `<div class="card"><h3>Neuromuscular blockers — tap to log</h3>${richNmbTableHtml(s)}</div>`;
    else if(step.id === "waiting") html += `<div class="card"><p class="note">Allow the paralytic to take effect before laryngoscopy (~45–60s for rocuronium, ~30–60s for succinylcholine).</p></div>` + timerHtml("waitTimer", 60, "Waiting for paralysis");
    else if(step.id === "laryngoscopy") html += laryngoscopyHtml(s);
    else if(step.id === "confirm") html += confirmHtml(s);
    else if(step.id === "secure") html += secureHtml(s);

    body.innerHTML = html;
    wireStepBody(step, s);
  },

  renderTimeline(){
    const wrap = document.getElementById("rsiTimelineList");
    if(!wrap) return;
    wrap.innerHTML = IDEAL_TIMELINE.map((row,i)=>{
      const cls = i < this.state.stepIndex ? "past" : (i === this.state.stepIndex ? "current" : "");
      return `<div class="tl-row ${cls}"><span>${fmtTime(row.t)} ${row.label}</span>${cls==="past"?"<span>✓</span>":""}</div>`;
    }).join("");
  }
};

/* ---------------- helpers ---------------- */

function fmtTime(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

/* ---- LEMON scored assessment ---- */
function lemonHtml(s){
  const score = LEMON_ITEMS.filter((_,i)=>s.lemonChecked.has("lemon"+i)).length;
  const rec = lemonRecommendation(score);
  return `<div class="card">
    <h3>Indication</h3>
    <input type="text" id="indicationInput" placeholder="e.g. Respiratory failure, GCS 6 post-trauma" value="${s.indication}" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:13.5px;">
  </div>
  <div class="card">
    <h3>LEMON assessment</h3>
    <ul class="chk" id="lemonChk">
      ${LEMON_ITEMS.map((txt,i)=>`<li data-key="lemon${i}" class="${s.lemonChecked.has('lemon'+i)?'on':''}"><span class="box">✓</span><span class="label">${txt}</span></li>`).join("")}
    </ul>
    <div class="lemon-banner tier-${rec.tier}">
      <div class="lemon-score">${score}/5</div>
      <div><div class="lemon-tier">${rec.label}</div><div class="lemon-text">${rec.text}</div></div>
    </div>
  </div>`;
}

/* ---- Mandatory challenge-response equipment checklist ---- */
function equipHtml(s){
  const total = EQUIPMENT_CHECKLIST.length;
  const checked = EQUIPMENT_CHECKLIST.filter((_,i)=>s.equipChecked.has("equip"+i)).length;
  const complete = checked === total;
  return `<div class="card">
    <div class="chk-pct ${complete?'complete':''}">${checked}/${total}</div>
    <p class="note">Challenge-response — confirm each item is physically present before continuing.</p>
    <ul class="chk" id="equipChk">
      ${EQUIPMENT_CHECKLIST.map((txt,i)=>`<li data-key="equip${i}" class="${s.equipChecked.has('equip'+i)?'on':''}"><span class="box">✓</span><span class="label">${txt}</span></li>`).join("")}
    </ul>
    ${!complete?'<div class="callout amber">All items must be confirmed before NEXT will proceed.</div>':'<div class="callout green">Equipment confirmed. Ready to proceed.</div>'}
  </div>`;
}

/* ---- Branching preoxygenation ---- */
function preoxHtml(s){
  let html = `<div class="card"><h3>Technique</h3><p class="note">Spontaneously breathing: tight non-rebreather at max flow, ≥5 min, avoid PPV if possible.<br>Not breathing adequately: BVM + reservoir 15L/min, 1 breath / 6s.</p></div>`;
  html += timerHtml("preoxTimer", 300, "Preoxygenation (5 min)");
  html += `<div class="card"><h3>Is oxygenation adequate?</h3><div class="branch">
      <button class="act green" id="preoxYes">YES — SpO2 sustained</button>
      <button class="act red" id="preoxNo">NO — desaturating</button>
    </div></div>`;
  if(s.preoxAdequate === false){
    html += `<div class="card"><h3>Escalation options</h3><div class="chiprow" id="preoxPlanChips">
      <button class="chip ${s.preoxPlan==='niv'?'on':''}" data-plan="niv">NIV (BiPAP/CPAP)</button>
      <button class="chip ${s.preoxPlan==='bvm'?'on':''}" data-plan="bvm">Gentle BVM, 2-person</button>
      <button class="chip ${s.preoxPlan==='dsi'?'on':''}" data-plan="dsi">Delayed sequence intubation</button>
    </div><div class="note" id="preoxPlanNote">${preoxPlanNote(s.preoxPlan)}</div></div>`;
  }
  return html;
}
function preoxPlanNote(plan){
  if(plan === "niv") return "Apply NIV with tight seal for a few minutes to recruit and improve SpO2 before re-attempting apnea period.";
  if(plan === "bvm") return "Two-person technique (one holds mask seal + jaw thrust, one bags), PEEP valve if available, small tidal volumes to avoid aspiration.";
  if(plan === "dsi") return "Give a dissociative dose of ketamine (~1–1.5mg/kg) to allow the patient to tolerate preoxygenation/NIV without agitation, then proceed to paralytic once saturations are optimized.";
  return "Choose an escalation strategy, then continue once SpO2 is optimized.";
}

function weightAgeInputsHtml(s){
  const ageField = s.mode === "child" ? `<input type="number" id="ageInput" placeholder="Age (yrs)" value="${s.ageYears ?? ""}">` : "";
  return `<div class="card"><h3>Patient</h3><div class="inline-inputs">
    ${ageField}<input type="number" id="weightInput" placeholder="Weight kg" value="${s.weightKg ?? ""}">
  </div>${s.mode==="child"?'<p class="note">Enter age to auto-estimate weight, or enter weight directly if known.</p>':""}</div>`;
}
function categoryChipsHtml(s){
  return `<div class="card"><h3>Category</h3><div class="chiprow" id="rsiCategoryChips">
    ${Object.entries(CATEGORIES).map(([k,c])=>`<button class="chip ${k===s.category?'on':''}" data-cat="${k}">${c.label}</button>`).join("")}
  </div><div class="note">${CATEGORIES[s.category].note}</div></div>`;
}
function checklistHtml(id, items, storeSet, prefix, showPct){
  const total = items.length;
  const checked = items.filter((_,i)=>storeSet.has(prefix+i)).length;
  return `<div class="card">
    ${showPct?`<div class="chk-pct">${Math.round((checked/total)*100)}%</div>`:""}
    <ul class="chk" id="${id}">
      ${items.map((txt,i)=>`<li data-key="${prefix}${i}" class="${storeSet.has(prefix+i)?'on':''}"><span class="box">✓</span><span class="label">${txt}</span></li>`).join("")}
    </ul>
  </div>`;
}

/* ---- Drug tables with onset/duration/contraindications ---- */
function richDoseTableHtml(list, s, logCtx){
  return list.map(d=>{
    const val = Calc.weightDose(d.dose, s.weightKg);
    const doseTxt = val ? `${val.toFixed(1)} ${d.unit.split(" ")[0]}` : "— enter weight";
    const recommended = d.bestFor && d.bestFor.includes(s.category);
    return `<div class="drugcard ${recommended?'recommended':''}" data-drugid="${d.id}" data-logctx="${logCtx}">
      <div class="drugcard-top"><span class="drugname">${d.name}${recommended?' <span class="rec-tag">preferred for '+CATEGORIES[s.category].label+'</span>':''}</span><span class="drugdose">${doseTxt}</span></div>
      <div class="drugmeta"><span>Onset: ${d.onset||"—"}</span><span>Duration: ${d.duration||"—"}</span></div>
      ${d.note?`<div class="drugnote">${d.note}</div>`:""}
      ${d.avoid?`<div class="drugavoid"><b>Avoid in:</b> ${d.avoid.join(", ")}</div>`:""}
      <button class="act small tap-give">Tap to log administered</button>
    </div>`;
  }).join("");
}
function richNmbTableHtml(s){
  return NMB.map(d=>{
    const val = Calc.weightDose(d.dose, s.weightKg);
    const doseTxt = val ? `${val.toFixed(1)} mg` : "— enter weight";
    return `<div class="drugcard" data-drugid="${d.id}" data-logctx="paralytic">
      <div class="drugcard-top"><span class="drugname">${d.name}</span><span class="drugdose">${doseTxt}</span></div>
      <div class="drugmeta"><span>Onset: ${d.onset}</span><span>Duration: ${d.duration}</span></div>
      ${d.note?`<div class="drugnote">${d.note}</div>`:""}
      ${d.avoid?`<div class="drugavoid"><b>Avoid in:</b> ${d.avoid.join(", ")}</div>`:""}
      <button class="act small tap-give">Tap to log administered</button>
    </div>`;
  }).join("");
}

function timerHtml(id, seconds, label){
  return `<div class="attempt" id="${id}" data-seconds="${seconds}" data-remaining="${seconds}">
    <div class="lbl">${label}</div><div class="n">${fmtTime(seconds)}</div>
    <div class="btnrow" style="margin-top:10px;">
      <button class="act ghost" data-timerstart="${id}">Start</button>
      <button class="act ghost" data-timerreset="${id}">Reset</button>
    </div></div>`;
}

function laryngoscopyHtml(s){
  return `<div class="attempt" id="laryTimer" data-seconds="30" data-remaining="30">
    <div class="lbl">Attempt ${s.attemptNumber+1}</div>
    <div class="n">00</div>
    <div class="stop">STOP ATTEMPT</div>
    <div class="btnrow" style="margin-top:10px;">
      <button class="act ghost" id="laryStart">Start attempt</button>
      <button class="act ghost" id="laryNewAttempt">New attempt</button>
    </div></div>
    <div class="btnrow" style="margin-top:10px;"><button class="act green" id="tubeInsertedBtn">Log: tube inserted</button></div>`;
}

function confirmHtml(s){
  const total = CONFIRMATION_CHECKLIST.length;
  const checked = CONFIRMATION_CHECKLIST.filter((_,i)=>s.confirmChecked.has("confirm"+i)).length;
  return `<div class="card">
    <div class="chk-pct ${checked===total?'complete':''}">${checked}/${total}</div>
    <ul class="chk" id="confirmChk">
      ${CONFIRMATION_CHECKLIST.map((item,i)=>`<li data-key="confirm${i}" class="${item.primary?'primary':''} ${s.confirmChecked.has('confirm'+i)?'on':''}"><span class="box">✓</span><span class="label">${item.primary?'<b>PRIMARY:</b> ':''}${item.label}</span></li>`).join("")}
    </ul>
  </div>`;
}

function secureHtml(s){
  const isPed = s.mode === "child" && s.ageYears != null && !isNaN(s.ageYears);
  const pedSizes = isPed ? Calc.pediatricTubeSize(s.ageYears) : null;
  const tubeLabel = pedSizes ? `${pedSizes.uncuffed.toFixed(1)}mm uncuffed / ${pedSizes.cuffed.toFixed(1)}mm cuffed` : `${Calc.adultTubeSize("male")}mm`;
  const depth = isPed ? Calc.pediatricTubeDepth(s.ageYears) : Calc.tubeDepth(Calc.adultTubeSize("male"));
  return `<div class="card"><h3>Tube &amp; depth reference</h3>
    <div class="result">Suggested tube: ${tubeLabel}<br>Suggested depth at teeth/lips: ${depth ? depth.toFixed(1) : "—"}cm</div>
    <div class="inline-inputs" style="margin-top:10px;">
      <input type="number" id="finalTubeSize" step="0.5" placeholder="Actual tube mm">
      <input type="number" id="finalTubeDepth" step="0.5" placeholder="Actual depth cm">
    </div></div>
  <div class="card"><h3>Procedure detail</h3>
    <div class="inline-inputs">
      <select id="cormackSelect"><option value="">Cormack-Lehane grade</option>${CORMACK_LEHANE.map(g=>`<option value="${g.v}">${g.label}</option>`).join("")}</select>
    </div>
    <div class="settingrow"><span>Bougie used</span><input type="checkbox" id="bougieCheck" class="switch"></div>
    <div class="inline-inputs">
      <input type="text" id="operatorInput" placeholder="Operator name">
      <input type="text" id="assistantInput" placeholder="Assistant name">
    </div>
    <textarea id="complicationsInput" placeholder="Complications (leave blank if none)" style="width:100%;min-height:60px;border:1px solid var(--line);border-radius:8px;padding:8px;font-size:13px;margin-top:8px;"></textarea>
  </div>
  <div class="btnrow"><button class="act green" id="genReportBtn">Generate documentation</button></div>`;
}

function wireStepBody(step, s){
  document.querySelectorAll("ul.chk li[data-key]").forEach(li=>{
    li.addEventListener("click", ()=>{
      const key = li.dataset.key;
      const set = key.startsWith("confirm") ? s.confirmChecked : key.startsWith("equip") ? s.equipChecked : key.startsWith("lemon") ? s.lemonChecked : s.posChecked;
      set.has(key) ? set.delete(key) : set.add(key);
      RSI.renderStepBody(step);
      if(key.startsWith("confirm") && set.has(key)){
        const idx = parseInt(key.replace("confirm",""),10);
        RSI.logEvent(CONFIRMATION_CHECKLIST[idx].label + " confirmed");
      }
    });
  });

  const indication = document.getElementById("indicationInput");
  if(indication) indication.addEventListener("input", e=>{ s.indication = e.target.value; });

  const wt = document.getElementById("weightInput");
  if(wt) wt.addEventListener("input", e=>{ s.weightKg = parseFloat(e.target.value)||null; RSI.renderStepBody(step); });
  const ag = document.getElementById("ageInput");
  if(ag) ag.addEventListener("input", e=>{
    s.ageYears = parseFloat(e.target.value);
    if(!isNaN(s.ageYears)){ const est = pediatricWeightEstimate(s.ageYears); if(est) s.weightKg = est; }
    RSI.renderStepBody(step);
  });

  document.querySelectorAll("#rsiCategoryChips .chip").forEach(chip=>{
    chip.addEventListener("click", ()=>{ s.category = chip.dataset.cat; RSI.renderStepBody(step); });
  });

  // preox adequate / inadequate branch
  const preoxYes = document.getElementById("preoxYes");
  if(preoxYes) preoxYes.addEventListener("click", ()=>{ s.preoxAdequate = true; RSI.logEvent("Preoxygenation adequate"); RSI.goStep(1); });
  const preoxNo = document.getElementById("preoxNo");
  if(preoxNo) preoxNo.addEventListener("click", ()=>{ s.preoxAdequate = false; RSI.logEvent("Preoxygenation inadequate — escalating"); RSI.renderStepBody(step); });
  document.querySelectorAll("#preoxPlanChips .chip").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      s.preoxPlan = chip.dataset.plan;
      RSI.logEvent(`Preox escalation: ${chip.textContent}`);
      RSI.renderStepBody(step);
    });
  });

  // drug cards -> log
  document.querySelectorAll(".drugcard").forEach(card=>{
    card.querySelector(".tap-give").addEventListener("click", ()=>{
      const id = card.dataset.drugid;
      const src = [...SEDATIVES, ...NMB].find(d=>d.id===id);
      const val = Calc.weightDose(src.dose, s.weightKg);
      const doseTxt = val ? `${val.toFixed(1)} ${src.unit.split(" ")[0]}` : src.unit;
      RSI.logDrug(src.name, doseTxt);
      card.classList.add("given");
      card.querySelector(".tap-give").textContent = "✓ Logged";
      card.querySelector(".tap-give").disabled = true;
    });
  });

  document.querySelectorAll("[data-timerstart]").forEach(btn=>btn.addEventListener("click", ()=>startGenericTimer(btn.dataset.timerstart)));
  do
