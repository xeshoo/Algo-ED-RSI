/* ==========================================================================
   CALCULATORS.JS — Pure math: IBW, tube size/depth, LEMON, shock index
   ========================================================================== */

"use strict";

const Calc = (() => {

  /* Ideal / predicted body weight (Devine formula) */
  function ibw(heightCm, sex) {
    const inches = heightCm / 2.54;
    if (sex === "female") return 45.5 + 2.3 * (inches - 60);
    return 50 + 2.3 * (inches - 60);
  }

  /* Tube size (adult: by sex; child: age/4+4) */
  function tubeSize(ageYears, sex) {
    if (ageYears !== null && ageYears !== undefined && ageYears < 16) {
      const uncuffed = (ageYears / 4) + 4;
      const cuffed = uncuffed - 0.5;
      return {
        uncuffed: uncuffed.toFixed(1),
        cuffed: cuffed.toFixed(1),
        depth: (uncuffed * 3).toFixed(0),
        note: "Cuffed acceptable from term neonate — use low-pressure cuff",
      };
    }
    if (sex === "female") return { size: "7.0", depth: "20" };
    return { size: "8.0", depth: "22" };
  }

  /* LMA size by weight */
  function lmaSize(weightKg) {
    const table = DATA.lmaSizes;
    for (const row of table) {
      const [lo, hi] = row.weight.replace(/[^\d–-]/g, "").split(/[–-]/).map(Number);
      if (weightKg >= lo && weightKg <= (hi || 999)) return row;
    }
    return table[table.length - 1];
  }

  /* LEMON score calculation */
  function lemonScore(flags) {
    let score = 0;
    const allCriteria = [
      ...DATA.lemon.external,
      ...DATA.lemon.look,
      ...DATA.lemon.evaluate_3_3,
      ...DATA.lemon.mallampati,
      ...DATA.lemon.neck,
      ...DATA.lemon.obstruction,
    ];
    for (const criterion of allCriteria) {
      if (flags.includes(criterion.id)) score++;
    }

    let risk;
    if (score <= 1) risk = DATA.lemon.scoring.green;
    else if (score <= 3) risk = DATA.lemon.scoring.amber;
    else risk = DATA.lemon.scoring.red;

    return { score, risk };
  }

  /* Shock index & MAP */
  function shockIndex(hr, sbp, dbp) {
    const si = hr / sbp;
    const map = dbp + (sbp - dbp) / 3;
    let interp;
    if (si < 0.6) interp = "Normal";
    else if (si < 1.0) interp = "Mild shock";
    else if (si < 1.4) interp = "Moderate shock";
    else interp = "Severe shock — consider massive transfusion";
    return { si: si.toFixed(2), map: map.toFixed(0), interpretation: interp };
  }

  /* Vasopressor infusion rate: dose (mcg/kg/min) × weight (kg) × 60 / conc (mg/mL) = mL/hr */
  function pressorRate(dosePerKgMin, weightKg, concMgPerMl) {
    const rate = (dosePerKgMin * weightKg * 60) / concMgPerMl;
    return rate.toFixed(1);
  }

  /* Drug dose calculation */
  function drugDose(dosePerKg, weightKg, maxDose, minDose) {
    let dose = dosePerKg * weightKg;
    if (maxDose) dose = Math.min(dose, maxDose);
    if (minDose) dose = Math.max(dose, minDose);
    return Math.round(dose * 10) / 10;
  }

  return { ibw, tubeSize, lmaSize, lemonScore, shockIndex, pressorRate, drugDose };
})();
