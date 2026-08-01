/* ==========================================================================
   APP.JS — routing + all screens that aren't the core RSI workflow.
   ========================================================================== */

const App = {
  settings: { dark:false, voice:true, vibrate:true },
  history: ["dashboard"],
  deferredInstallPrompt: null,

  async init(){
    this.settings.dark = await Store.getSetting("dark", false);
    this.settings.voice = await Store.getSetting("voice", true);
    this.settings.vibrate = await Store.getSetting("vibrate", true);
    Voice.enabled = this.settings.voice;
    document.body.classList.toggle("dark", this.settings.dark);
    document.getElementById("setDark").checked = this.settings.dark;
    document.getElementById("setVoice").checked = this.settings.voice;
    document.getElementById("setVibrate").checked = this.settings.vibrate;

    this.wireNav();
    this.wireSettings();
    this.wireEmergency();
    this.buildCalculatorScreen();
    this.buildFailedAirway();
    this.buildCric();
    this.buildVentilator();
    this.buildCalculatorsTools();
    this.wireReportButtons();
    this.renderReports();
    this.registerServiceWorker();
    this.wireInstallPrompt();
  },

  navigate(screenId, opts){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    document.getElementById("screen-"+screenId).classList.add("active");
    const titles = {
      dashboard:"ER Airway Assistant", rsi: opts?.mode==="child" ? "Pediatric RSI":"Adult RSI",
      calculator:"Drug Calculator", failed:"Failed Airway", cric:"Cricothyrotomy",
      ventilator:"Ventilator Presets", calculators:"Airway Calculators", reports:"Case Report", settings:"Settings"
    };
    document.getElementById("screenTitle").textContent = titles[screenId] || "ER Airway Assistant";
    document.getElementById("backBtn").hidden = screenId === "dashboard";
    if(screenId !== "dashboard") this.history.push(screenId);
    if(screenId === "rsi") RSI.start(opts?.mode || "adult");
    if(screenId === "failed"){ this.faPath = [FAILED_AIRWAY_TREE.start]; this.renderFailedAirway(); }
    window.scrollTo(0,0);
  },

  wireNav(){
    document.querySelectorAll("[data-nav]").forEach(btn=>{
      btn.addEventListener("click", ()=>this.navigate(btn.dataset.nav, { mode: btn.dataset.mode }));
    });
    document.getElementById("backBtn").addEventListener("click", ()=>this.navigate("dashboard"));
    document.getElementById("settingsBtn").addEventListener("click", ()=>this.navigate("settings"));
    document.getElementById("rsiNext").addEventListener("click", ()=>RSI.goStep(1));
    document.getElementById("rsiBack").addEventListener("click", ()=>RSI.goStep(-1));
  },

  wireSettings(){
    document.getElementById("setDark").addEventListener("change", e=>{
      this.settings.dark = e.target.checked;
      document.body.classList.toggle("dark", e.target.checked);
      Store.setSetting("dark", e.target.checked);
    });
    document.getElementById("setVoice").addEventListener("change", e=>{
      this.settings.voice = e.target.checked; Voice.setEnabled(e.target.checked);
      Store.setSetting("voice", e.target.checked);
    });
    document.getElementById("setVibrate").addEventListener("change", e=>{
      this.settings.vibrate = e.target.checked; Store.setSetting("vibrate", e.target.checked);
    });
  },

  wireEmergency(){
    document.getElementById("rsiEmergency").addEventListener("click", ()=>{
      document.getElementById("emergencyOverlay").hidden = false;
    });
    document.getElementById("emgToFailed").addEventListener("click", ()=>{
      document.getElementById("emergencyOverlay").hidden = true;
      this.navigate("failed");
    });
    document.getElementById("emgResume").addEventListener("click", ()=>{
      document.getElementById("emergencyOverlay").hidden = true;
    });
  },

  /* ---------------- standalone drug calculator ---------------- */
  buildCalculatorScreen(){
    const chipWrap = document.getElementById("calcCategoryChips");
    let category = "adult";
    chipWrap.innerHTML = Object.entries(CATEGORIES).map(([k,c])=>
      `<button class="chip ${k===category?'on':''}" data-cat="${k}">${c.label}</button>`).join("");
    const noteEl = document.getElementById("calcCategoryNote");
    noteEl.textContent = CATEGORIES[category].note;

    const wtInput = document.getElementById("calcWeight");
    const renderTables = ()=>{
      const wt = parseFloat(wtInput.value) || null;
      document.getElementById("calcSedTable").innerHTML = drugCardsHtml(SEDATIVES, wt, category);
      document.getElementById("calcNmbTable").innerHTML = nmbCardsHtml(wt);
      document.getElementById("calcInfTable").innerHTML = buildDoseRows(SEDATION_INFUSIONS, wt);
    };
    chipWrap.querySelectorAll(".chip").forEach(chip=>{
      chip.addEventListener("click", ()=>{
        category = chip.dataset.cat;
        chipWrap.querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));
        chip.classList.add("on");
        noteEl.textContent = CATEGORIES[category].note;
        renderTables();
      });
    });
    wtInput.addEventListener("input", renderTables);
    renderTables();
  },

  /* ---------------- failed airway — interactive decision tree ---------------- */
  buildFailedAirway(){
    this.faPath = [FAILED_AIRWAY_TREE.start];
    this.renderFailedAirway();
  },
  renderFailedAirway(){
    const wrap = document.getElementById("failedFlow");
    const tree = FAILED_AIRWAY_TREE;
    wrap.innerHTML = this.faPath.map((nodeId,i)=>{
      const node = tree.nodes[nodeId];
      const isLast = i === this.faPath.length-1;
      let html = `${i>0?'<div class="flow-arrow">&#8595;</div>':""}
        <div class="flow-step ${node.critical?'critical':''}"><span class="n">${i+1}</span>${node.label}</div>
        <div class="flow-detail open">${node.detail}</div>`;
      if(isLast && node.branch){
        html += `<div class="branch-col">${node.branch.map(b=>
          `<button class="act ${node.critical?'red':'ghost'}" data-goto="${b.to}">${b.label}</button>`).join("")}</div>`;
      }
      if(isLast && node.terminal){
        html += `<div class="btnrow"><button class="act green" data-terminal="${node.terminal}">Continue →</button></div>`;
      }
      return html;
    }).join("");
    wrap.querySelectorAll("[data-goto]").forEach(btn=>{
      btn.addEventListener("click", ()=>{ this.faPath.push(btn.dataset.goto); this.renderFailedAirway(); window.scrollTo(0, document.body.scrollHeight); });
    });
    wrap.querySelectorAll("[data-terminal]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const dest = btn.dataset.terminal;
        if(dest === "cric") this.navigate("cric");
        else if(dest === "confirm" && RSI.state){ this.navigate("rsi", { mode:RSI.state.mode }); RSI.jumpTo("confirm"); }
        else this.navigate("dashboard");
      });
    });
    const resetBtn = wrap.parentElement.querySelector(".flow-reset");
    if(!resetBtn){
      const btn = document.createElement("button");
      btn.className = "act ghost flow-reset";
      btn.textContent = "Restart algorithm";
      btn.style.marginTop = "10px";
      btn.addEventListener("click", ()=>{ this.faPath = [tree.start]; this.renderFailedAirway(); });
      wrap.parentElement.appendChild(btn);
    }
  },

  /* ---------------- cricothyrotomy ---------------- */
  buildCric(){
    const wrap = document.getElementById("cricFlow");
    wrap.innerHTML = CRIC_STEPS.map((step,i)=>`
      <div class="flow-step" data-cid="${step.id}"><span class="n">${i+1}</span>${step.label}</div>
      <div class="flow-detail" id="cdetail-${step.id}">${step.detail}</div>
    `).join("");
    wrap.querySelectorAll("[data-cid]").forEach(el=>{
      el.addEventListener("click", ()=>document.getElementById("cdetail-"+el.dataset.cid).classList.toggle("open"));
    });
    let start=null, interval=null;
    document.getElementById("cricStart").addEventListener("click", (e)=>{
      if(interval) return;
      start = Date.now();
      interval = setInterval(()=>{
        document.getElementById("cricClock").textContent = fmtTime(Math.floor((Date.now()-start)/1000));
      },1000);
      e.target.textContent = "RUNNING";
      e.target.disabled = true;
    });
  },

  /* ---------------- ventilator presets ---------------- */
  buildVentilator(){
    const grid = document.getElementById("ventGrid");
    grid.innerHTML = Object.entries(VENT_PRESETS).map(([k,v])=>
      `<button class="tile" data-vent="${k}">${v.label}</button>`).join("");
    const detail = document.getElementById("ventDetail");
    grid.querySelectorAll("[data-vent]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const v = VENT_PRESETS[btn.dataset.vent];
        detail.hidden = false;
        const rows = [["Mode",v.mode],["Tidal volume",v.tv],["Resp. rate",v.rr],["PEEP",v.peep],["FiO2",v.fio2],["Trigger",v.trigger],["Insp. flow",v.flow],["I:E ratio",v.ie]];
        detail.innerHTML = `<h3>${v.label}</h3>
          <table class="dosetable">${rows.map(([k2,val])=>`<tr><td>${k2}</td><td class="calc">${val}</td></tr>`).join("")}</table>
          ${v.note?`<div class="callout blue">${v.note}</div>`:""}`;
        detail.scrollIntoView({behavior:"smooth", block:"nearest"});
      });
    });
  },

  /* ---------------- airway calculators ---------------- */
  buildCalculatorsTools(){
    const ibwOut = document.getElementById("cIBWOut");
    const recalcIBW = ()=>{
      const h = parseFloat(document.getElementById("cHeight").value);
      const sex = document.getElementById("cSex").value;
      if(!h){ ibwOut.textContent = "—"; return; }
      const v = Calc.idealBodyWeight(h, sex);
      ibwOut.textContent = `IBW/PBW ≈ ${v.toFixed(1)} kg  ·  Lung-protective TV (6mL/kg) ≈ ${(v*6).toFixed(0)} mL`;
    };
    document.getElementById("cHeight").addEventListener("input", recalcIBW);
    document.getElementById("cSex").addEventListener("change", recalcIBW);

    const tubeOut = document.getElementById("cTubeOut");
    const recalcTube = ()=>{
      const age = parseFloat(document.getElementById("cAge").value);
      if(isNaN(age)){
        const mm = Calc.adultTubeSize("male");
        tubeOut.textContent = `Adult: ~${mm}mm (M) / 7.5mm (F) · Depth ≈ ${Calc.tubeDepth(mm)}cm`;
      } else {
        const sizes = Calc.pediatricTubeSize(age);
        const depth = Calc.pediatricTubeDepth(age);
        tubeOut.textContent = sizes
          ? `Uncuffed ≈ ${sizes.uncuffed.toFixed(1)}mm · Cuffed ≈ ${sizes.cuffed.toFixed(1)}mm · Depth ≈ ${depth.toFixed(1)}cm`
          : "—";
      }
    };
    document.getElementById("cAge").addEventListener("input", recalcTube);
    recalcTube();

    const lmaOut = document.getElementById("cLmaOut");
    document.getElementById("cLmaWeight").addEventListener("input", (e)=>{
      const wt = parseFloat(e.target.value);
      const size = Calc.lmaSize(wt);
      lmaOut.textContent = size ? `LMA size ${size}` : "—";
    });

    const flags = ["External markers of difficulty","3-3-2 rule positive","Mallampati ≥3","Obstruction / obesity","Reduced neck mobility"];
    const flagState = {};
    document.getElementById("cDASFlags").innerHTML = flags.map((f,i)=>
      `<label><input type="checkbox" data-flag="${i}"> ${f}</label>`).join("");
    document.querySelectorAll("#cDASFlags input").forEach(cb=>{
      cb.addEventListener("change", ()=>{
        flagState[cb.dataset.flag] = cb.checked;
        const score = Calc.difficultAirwayScore(flagState);
        document.getElementById("cDASOut").textContent = `${score} predictor${score===1?"":"s"} present${score>=2?" — anticipate a difficult airway":""}`;
      });
    });

    const shockOut = document.getElementById("cShockOut");
    const recalcShock = ()=>{
      const hr = parseFloat(document.getElementById("cHR").value);
      const sbp = parseFloat(document.getElementById("cSBP").value);
      const dbp = parseFloat(document.getElementById("cDBP").value);
      const si = Calc.shockIndex(hr, sbp);
      const map = Calc.map(sbp, dbp);
      shockOut.textContent = `${si?`Shock index: ${si.toFixed(2)}${si>0.9?" (elevated)":""}`:"Shock index: —"}\n${map?`MAP: ${map.toFixed(0)} mmHg`:"MAP: —"}`;
    };
    ["cHR","cSBP","cDBP"].forEach(id=>document.getElementById(id).addEventListener("input", recalcShock));

    const pressorChips = document.getElementById("cPressorChips");
    let pressor = VASOPRESSORS[0];
    pressorChips.innerHTML = VASOPRESSORS.map((p,i)=>`<button class="chip ${i===0?'on':''}" data-p="${i}">${p.name}</button>`).join("");
    const recalcPressor = ()=>{
      const wt = parseFloat(document.getElementById("cPressorWeight").value);
      const conc = parseFloat(document.getElementById("cPressorConc").value);
      const rate = Calc.pressorMlPerHr(pressor.dose, wt, conc);
      document.getElementById("cPressorOut").textContent = rate
        ? `${pressor.name} start ≈ ${pressor.dose} ${pressor.unit} → ${rate.toFixed(1)} mL/hr`
        : `${pressor.name} typical start: ${pressor.dose} ${pressor.unit} (enter weight + concentration for mL/hr)`;
    };
    pressorChips.querySelectorAll("[data-p]").forEach(chip=>{
      chip.addEventListener("click", ()=>{
        pressorChips.querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));
        chip.classList.add("on");
        pressor = VASOPRESSORS[chip.dataset.p];
        recalcPressor();
      });
    });
    ["cPressorWeight","cPressorConc"].forEach(id=>document.getElementById(id).addEventListener("input", recalcPressor));
    recalcPressor();
  },

  /* ---------------- documentation generator ---------------- */
  lastReportText: "",
  buildReportFromRSI(s){
    const lemonScore = LEMON_ITEMS.filter((_,i)=>s.lemonChecked.has("lemon"+i)).length;
    const lemonRec = lemonRecommendation(lemonScore);
    const drugLines = s.drugsGiven.map(d=>`  ${d.time}  ${d.label} — ${d.dose}`).join("\n") || "  (none logged)";
    const confirmLines = CONFIRMATION_CHECKLIST.map((item,i)=>`  [${s.confirmChecked.has("confirm"+i)?"x":" "}] ${item.label}`).join("\n");
    const timelineLines = s.events.map(e=>`  ${e.wallTime}  (+${fmtTime(e.elapsed)})  ${e.label}`).join("\n") || "  (no events logged)";
    const cormackLabel = s.cormackLehane ? (CORMACK_LEHANE.find(g=>g.v===s.cormackLehane)||{}).label : "—";
    const text =
`RAPID SEQUENCE INTUBATION — ${s.mode === "child" ? "PEDIATRIC" : "ADULT"}
Case start: ${new Date(s.caseStart).toLocaleString()}
Total case time: ${fmtTime(s.elapsed)}
Indication: ${s.indication || "—"}
Weight: ${s.weightKg ?? "—"} kg${s.ageYears?` · Age: ${s.ageYears}y`:""}
Patient category: ${CATEGORIES[s.category]?.label || "—"}

Airway assessment (LEMON): ${lemonScore}/5 — ${lemonRec.label}

Drugs administered:
${drugLines}

Attempts: ${s.attemptNumber+1}
Cormack-Lehane grade: ${cormackLabel}
Bougie used: ${s.bougieUsed ? "Yes" : "No"}
Tube size: ${s.tubeSize || "—"} mm
Tube depth: ${s.tubeDepth || "—"} cm

Confirmation:
${confirmLines}

Operator: ${s.operator || "—"}
Assistant: ${s.assistant || "—"}
Complications: ${s.complications || "None"}

Timestamped event log:
${timelineLines}

Generated by ER Airway Assistant — verify all entries before filing.`;
    this.lastReportText = text;
    document.getElementById("reportOut").textContent = text;
    Store.saveCase({ mode:s.mode, text, savedAt: Date.now() });
    this.renderReports();
  },

  wireReportButtons(){
    document.getElementById("reportCopy").addEventListener("click", ()=>{
      navigator.clipboard?.writeText(this.lastReportText || document.getElementById("reportOut").textContent);
    });
    document.getElementById("reportPrint").addEventListener("click", ()=>window.print());
  },

  async renderReports(){
    const cases = await Store.listCases();
    const list = document.getElementById("savedCasesList");
    list.textContent = cases.length
      ? `${cases.length} case(s) saved on this device.`
      : "No saved cases yet — cases save automatically when you generate documentation.";
  },

  /* ---------------- PWA install + service worker ---------------- */
  registerServiceWorker(){
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("service-worker.js").catch(()=>{/* offline install requires HTTPS hosting */});
    }
  },
  wireInstallPrompt(){
    window.addEventListener("beforeinstallprompt", (e)=>{
      e.preventDefault();
      this.deferredInstallPrompt = e;
      document.getElementById("installBtn").hidden = false;
    });
    document.getElementById("installBtn").addEventListener("click", async ()=>{
      if(!this.deferredInstallPrompt) return;
      this.deferredInstallPrompt.prompt();
      await this.deferredInstallPrompt.userChoice;
      this.deferredInstallPrompt = null;
      document.getElementById("installBtn").hidden = true;
    });
  }
};

function buildDoseRows(list, wt){
  return list.map(d=>{
    const val = Calc.weightDose(d.dose, wt);
    return `<tr><td>${d.name}${d.range?`<span class="sub">${d.range} ${d.unit}</span>`:""}</td>
      <td class="calc">${val?val.toFixed(2)+" "+d.unit:"— enter wt"}</td></tr>`;
  }).join("");
}

function drugCardsHtml(list, wt, category){
  return list.map(d=>{
    const val = Calc.weightDose(d.dose, wt);
    const doseTxt = val ? `${val.toFixed(1)} ${d.unit.split(" ")[0]}` : "— enter weight";
    const recommended = d.bestFor && category && d.bestFor.includes(category);
    return `<div class="drugcard ${recommended?'recommended':''}">
      <div class="drugcard-top"><span class="drugname">${d.name}${recommended?` <span class="rec-tag">preferred for ${CATEGORIES[category].label}</span>`:''}</span><span class="drugdose">${doseTxt}</span></div>
      <div class="drugmeta"><span>Onset: ${d.onset||"—"}</span><span>Duration: ${d.duration||"—"}</span></div>
      ${d.note?`<div class="drugnote">${d.note}</div>`:""}
      ${d.avoid?`<div class="drugavoid"><b>Avoid in:</b> ${d.avoid.join(", ")}</div>`:""}
    </div>`;
  }).join("");
}
function nmbCardsHtml(wt){
  return NMB.map(d=>{
    const val = Calc.weightDose(d.dose, wt);
    const doseTxt = val ? `${val.toFixed(1)} mg` : "— enter weight";
    return `<div class="drugcard">
      <div class="drugcard-top"><span class="drugname">${d.name}</span><span class="drugdose">${doseTxt}</span></div>
      <div class="drugmeta"><span>Onset: ${d.onset}</span><span>Duration: ${d.duration}</span></div>
      ${d.note?`<div class="drugnote">${d.note}</div>`:""}
      ${d.avoid?`<div class="drugavoid"><b>Avoid in:</b> ${d.avoid.join(", ")}</div>`:""}
    </div>`;
  }).join("");
}

document.addEventListener("DOMContentLoaded", ()=>App.init());
                      
