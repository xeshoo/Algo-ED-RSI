/* ==========================================================================
   RSI.JS — drives the full-screen RSI workflow (shared adult/pediatric).
   State lives in RSI.state; render functions rebuild #rsiStepBody per step.
   ========================================================================== */

const RSI = {
  state: null,
  clockInt: null,
  attemptInt: null,

  reset(mode){
    this.state = {
      mode,                      // "adult" | "child"
      category: mode === "child" ? "child" : "adult",
      stepIndex: 0,
      caseStart: null,
      elapsed: 0,
      weightKg: null,
      ageYears: null,
      equipChecked: new Set(),
      confirmChecked: new Set(),
      drugsGiven: [],            // {label, dose, time, elapsed}
      attemptNumber: 0,
      tubeSize: null,
      tubeDepth: null
    };
  },

  start(mode){
    this.reset(mode);
    this.state.caseStart = Date.now();
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
    if(delta > 5){
      el.textContent = `⚠ Behind by ${delta}s`;
      el.classList.add("behind");
    } else {
      el.textContent = delta < -5 ? "Ahead of pace" : "On pace";
      el.classList.remove("behind");
    }
    this.renderTimeline();
  },

  vibrate(pattern){
    if(App.settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
  },

  goStep(delta){
    const next = this.state.stepIndex + delta;
    if(next < 0 || next >= RSI_STEPS.length) return;
    this.state.stepIndex = next;
    this.vibrate(40);
    Voice.say(RSI_STEPS[next].voice);
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
    document.getElementById("rsiNext").textContent = next ? "NEXT" : "FINISH";
    this.renderStepBody(step);
    this.updateDelta();
  },

  renderStepBody(step){
    const body = document.getElementById("rsiStepBody");
    const s = this.state;
    let html = "";

    if(step.id === "lemon"){
      html += weightAgeInputsHtml(s);
      html += checklistHtml("lemonChk", [
        "Look for external markers of difficult airway",
        "Evaluate the 3-3-2 rule",
        "Mallampati score ≥ 3",
        "Obstruction / obesity",
        "Reduced neck mobility"
      ], s.equipChecked, "lemon");
    }
    else if(step.id === "equip"){
      html += checklistHtml("equipChk", EQUIPMENT_CHECKLIST, s.equipChecked, "equip", true);
    }
    else if(step.id === "preox"){
      html += `<div class="card"><h3>Technique</h3><p class="note">Spontaneously breathing: tight non-rebreather at max flow, ≥5 min, avoid PPV if possible.<br>Not breathing adequately: BVM + reservoir 15L/min, 1 breath / 6s.</p></div>`;
      html += timerHtml("preoxTimer", 300, "Preoxygenation (5 min)");
    }
    else if(step.id === "position"){
      html += checklistHtml("posChk", [
        "Belt/belly height — head at/above belt level",
        "Head of patient up to head of bed",
        "Head of bed up 30°",
        "Ear level to sternal notch, face plane parallel to ceiling",
        "Assistants ready (laryngeal manipulation, jaw thrust)"
      ], s.equipChecked, "pos");
    }
    else if(step.id === "induction"){
      html += weightAgeInputsHtml(s);
      html += categoryChipsHtml();
      html += `<div class="card"><h3>Sedatives — pick one, tap to log</h3>${doseTableHtml(SEDATIVES, s, "induction")}</div>`;
    }
    else if(step.id === "paralytic"){
      html += `<div class="card"><h3>Neuromuscular blockers — pick one, tap to log</h3>${nmbTableHtml(s)}</div>`;
    }
    else if(step.id === "waiting"){
      html += `<div class="card"><p class="note">Allow the paralytic to take effect before laryngoscopy (~45–60s for rocuronium, ~30–60s for succinylcholine).</p></div>`;
      html += timerHtml("waitTimer", 60, "Waiting for paralysis");
    }
    else if(step.id === "laryngoscopy"){
      html += laryngoscopyHtml(s);
    }
    else if(step.id === "confirm"){
      html += checklistHtml("confirmChk", CONFIRMATION_CHECKLIST, s.confirmChecked, "confirm", true);
    }
    else if(step.id === "secure"){
      html += secureHtml(s);
    }

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
  },

  logDrug(label, doseText){
    this.state.drugsGiven.push({ label, dose:doseText, time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}), elapsed:this.state.elapsed });
    this.vibrate(30);
  }
};

/* ---------------- helpers to build HTML fragments ---------------- */

function fmtTime(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function weightAgeInputsHtml(s){
  const ageField = s.mode === "child" ? `<input type="number" id="ageInput" placeholder="Age (yrs)" value="${s.ageYears ?? ""}">` : "";
  return `<div class="card"><h3>Patient</h3><div class="inline-inputs">
    ${ageField}
    <input type="number" id="weightInput" placeholder="Weight kg" value="${s.weightKg ?? ""}">
  </div>${s.mode==="child"?'<p class="note">Enter age to auto-estimate weight, or enter weight directly if known.</p>':""}</div>`;
}

function categoryChipsHtml(){
  return `<div class="card"><h3>Category</h3><div class="chiprow" id="rsiCategoryChips">
    ${Object.entries(CATEGORIES).map(([k,c])=>`<button class="chip" data-cat="${k}">${c.label}</button>`).join("")}
  </div></div>`;
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

function doseTableHtml(list, s, logCtx){
  return `<table class="dosetable">${list.map(d=>{
    const val = Calc.weightDose(d.dose, s.weightKg);
    return `<tr data-drugid="${d.id}" data-logctx="${logCtx}">
      <td>${d.name}${d.note?`<span class="sub">${d.note}</span>`:""}</td>
      <td class="calc">${val?val.toFixed(1)+" "+d.unit.split(" ")[0]:"— wt?"}</td>
    </tr>`;
  }).join("")}</table>`;
}

function nmbTableHtml(s){
  return `<table class="dosetable">${NMB.map(d=>{
    const val = Calc.weightDose(d.dose, s.weightKg);
    return `<tr data-drugid="${d.id}" data-logctx="paralytic">
      <td>${d.name}<span class="sub">Onset ${d.onset} · Duration ${d.duration}${d.contraindications?` · CI: ${d.contraindications.join(", ")}`:""}</span></td>
      <td class="calc">${val?val.toFixed(1)+" mg":"— wt?"}</td>
    </tr>`;
  }).join("")}</table>`;
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
    </div></div>`;
}

function secureHtml(s){
  const isPed = s.mode === "child" && s.ageYears != null && !isNaN(s.ageYears);
  const pedSizes = isPed ? Calc.pediatricTubeSize(s.ageYears) : null;
  const tubeLabel = pedSizes
    ? `${pedSizes.uncuffed.toFixed(1)}mm uncuffed / ${pedSizes.cuffed.toFixed(1)}mm cuffed`
    : `${Calc.adultTubeSize("male")}mm`;
  const depth = isPed ? Calc.pediatricTubeDepth(s.ageYears) : Calc.tubeDepth(Calc.adultTubeSize("male"));
  return `<div class="card"><h3>Tube &amp; depth reference</h3>
    <div class="result">Suggested tube: ${tubeLabel}<br>
    Suggested depth at teeth/lips: ${depth ? depth.toFixed(1) : "—"}cm${isPed && !pedSizes ? " (under 1 year — use age/weight-specific chart)" : ""}</div>
    <div class="inline-inputs" style="margin-top:10px;">
      <input type="number" id="finalTubeSize" step="0.5" placeholder="Actual tube mm">
      <input type="number" id="finalTubeDepth" step="0.5" placeholder="Actual depth cm">
    </div>
  </div>
  <div class="btnrow"><button class="act green" id="genReportBtn">Generate documentation</button></div>`;
}

function wireStepBody(step, s){
  // checklists
  document.querySelectorAll("ul.chk li[data-key]").forEach(li=>{
    li.addEventListener("click", ()=>{
      const key = li.dataset.key;
      const set = key.startsWith("confirm") ? s.confirmChecked : s.equipChecked;
      set.has(key) ? set.delete(key) : set.add(key);
      li.classList.toggle("on");
      const card = li.closest(".card");
      const pctEl = card.querySelector(".chk-pct");
      if(pctEl){
        const total = li.closest("ul").children.length;
        const checked = li.closest("ul").querySelectorAll("li.on").length;
        pctEl.textContent = `${Math.round((checked/total)*100)}%`;
      }
    });
  });

  // weight / age inputs
  const wt = document.getElementById("weightInput");
  if(wt) wt.addEventListener("input", e=>{ s.weightKg = parseFloat(e.target.value)||null; RSI.renderStepBody(step); });
  const ag = document.getElementById("ageInput");
  if(ag) ag.addEventListener("input", e=>{
    s.ageYears = parseFloat(e.target.value);
    if(!isNaN(s.ageYears)){ const est = pediatricWeightEstimate(s.ageYears); if(est) s.weightKg = est; }
    RSI.renderStepBody(step);
  });

  // category chips
  document.querySelectorAll("#rsiCategoryChips .chip").forEach(chip=>{
    if(chip.dataset.cat === s.category) chip.classList.add("on");
    chip.addEventListener("click", ()=>{ s.category = chip.dataset.cat; RSI.renderStepBody(step); });
  });

  // dose table rows -> log drug on tap
  document.querySelectorAll("table.dosetable tr[data-drugid]").forEach(tr=>{
    tr.addEventListener("click", ()=>{
      const id = tr.dataset.drugid;
      const src = [...SEDATIVES, ...NMB].find(d=>d.id===id);
      const val = Calc.weightDose(src.dose, s.weightKg);
      const doseTxt = val ? `${val.toFixed(1)} ${src.unit.split(" ")[0]}` : src.unit;
      RSI.logDrug(src.name, doseTxt);
      tr.style.background = "var(--green-soft)";
    });
  });

  // generic timers
  document.querySelectorAll("[data-timerstart]").forEach(btn=>{
    btn.addEventListener("click", ()=>startGenericTimer(btn.dataset.timerstart));
  });
  document.querySelectorAll("[data-timerreset]").forEach(btn=>{
    btn.addEventListener("click", ()=>resetGenericTimer(btn.dataset.timerreset));
  });

  // laryngoscopy attempt timer
  const laryStart = document.getElementById("laryStart");
  if(laryStart) laryStart.addEventListener("click", startLaryngoscopyTimer);
  const laryNew = document.getElementById("laryNewAttempt");
  if(laryNew) laryNew.addEventListener("click", ()=>{
    s.attemptNumber++;
    RSI.renderStepBody(step);
  });

  // report generation
  const genBtn = document.getElementById("genReportBtn");
  if(genBtn) genBtn.addEventListener("click", ()=>{
    s.tubeSize = document.getElementById("finalTubeSize").value;
    s.tubeDepth = document.getElementById("finalTubeDepth").value;
    App.buildReportFromRSI(s);
    App.navigate("reports");
  });
}

/* ---------------- generic timers (preox / waiting) ---------------- */
const _timerHandles = {};
function startGenericTimer(id){
  const el = document.getElementById(id);
  if(!el || _timerHandles[id]) return;
  let remaining = parseInt(el.dataset.remaining,10);
  _timerHandles[id] = setInterval(()=>{
    remaining--;
    el.dataset.remaining = remaining;
    el.querySelector(".n").textContent = fmtTime(Math.max(remaining,0));
    if(remaining <= 0){ clearInterval(_timerHandles[id]); delete _timerHandles[id]; RSI.vibrate([80,40,80]); }
  },1000);
}
function resetGenericTimer(id){
  const el = document.getElementById(id);
  if(_timerHandles[id]){ clearInterval(_timerHandles[id]); delete _timerHandles[id]; }
  el.dataset.remaining = el.dataset.seconds;
  el.querySelector(".n").textContent = fmtTime(parseInt(el.dataset.seconds,10));
}

/* ---------------- laryngoscopy 30s attempt timer ---------------- */
let _laryCount = 0, _laryHandle = null;
function startLaryngoscopyTimer(){
  const el = document.getElementById("laryTimer");
  if(_laryHandle) return;
  el.classList.remove("warn");
  _laryCount = 0;
  el.querySelector(".n").textContent = "00";
  _laryHandle = setInterval(()=>{
    _laryCount++;
    el.querySelector(".n").textContent = String(_laryCount).padStart(2,"0");
    if(_laryCount >= 30){
      clearInterval(_laryHandle); _laryHandle = null;
      el.classList.add("warn");
      RSI.vibrate([200,100,200,100,200]);
      Voice.say("Stop attempt.");
    }
  },1000);
}
