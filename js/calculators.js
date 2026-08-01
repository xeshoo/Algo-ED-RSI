/* ==========================================================================
   CALCULATORS.JS — pure calculation functions, no DOM access.
   Formulas are standard/commonly-taught approximations for quick bedside
   reference; always cross-check against local protocol.
   ========================================================================== */

const Calc = {
  // Devine formula, cm height input
  idealBodyWeight(heightCm, sex){
    const heightIn = heightCm / 2.54;
    const base = sex === "female" ? 45.5 : 50;
    return Math.max(0, base + 2.3 * (heightIn - 60));
  },

  // ARDSnet predicted body weight — same Devine-based formula, kept distinct
  // because clinicians look for it by this name for lung-protective TV calcs
  predictedBodyWeight(heightCm, sex){
    return this.idealBodyWeight(heightCm, sex);
  },

  // Adult ET tube size (internal diameter, mm)
  adultTubeSize(sex){
    return sex === "female" ? 7.5 : 8.0;
  },

  // Pediatric uncuffed/cuffed tube size, age in years
  pediatricTubeSize(ageYears){
    if(ageYears == null || isNaN(ageYears) || ageYears < 1) return null;
    return { uncuffed: (ageYears/4)+4, cuffed: (ageYears/4)+3.5 };
  },

  // Tube depth at teeth/gums = 3x internal diameter (adult rule of thumb)
  tubeDepth(tubeSizeMm){
    return tubeSizeMm * 3;
  },

  // Pediatric tube depth (age-based, cm at lips)
  pediatricTubeDepth(ageYears){
    if(ageYears == null || isNaN(ageYears)) return null;
    return (ageYears/2)+12;
  },

  // LMA size by weight (kg) — standard adult/pediatric sizing chart
  lmaSize(weightKg){
    if(weightKg == null || isNaN(weightKg)) return null;
    const table = [
      [5,1],[10,1.5],[20,2],[30,2.5],[50,3],[70,4],[Infinity,5]
    ];
    for(const [max,size] of table){ if(weightKg <= max) return size; }
    return 5;
  },

  // Suggested laryngoscope blade size by age
  bladeSize(ageYears){
    if(ageYears == null || isNaN(ageYears)) return null;
    if(ageYears < 1) return "Miller 0–1 (straight)";
    if(ageYears < 8) return "Miller/Mac 1–2";
    return "Mac 3–4";
  },

  // Difficult airway score — simple additive LEMON-style count (0-5, higher = more predictors)
  difficultAirwayScore(flags){
    return Object.values(flags).filter(Boolean).length;
  },

  shockIndex(hr, sbp){
    if(!hr || !sbp) return null;
    return hr / sbp;
  },

  map(sbp, dbp){
    if(sbp == null || dbp == null) return null;
    return dbp + (sbp - dbp) / 3;
  },

  // Generic weight-based dose calculator: value = perKg * weightKg
  weightDose(perKg, weightKg){
    if(!perKg || !weightKg) return null;
    return perKg * weightKg;
  },

  // Convert mcg/kg/min pressor rate to mL/hr given a concentration (mg in mL bag)
  pressorMlPerHr(mcgPerKgPerMin, weightKg, concentrationMgPerMl){
    if(!mcgPerKgPerMin || !weightKg || !concentrationMgPerMl) return null;
    const mgPerMin = (mcgPerKgPerMin * weightKg) / 1000;
    const mlPerMin = mgPerMin / concentrationMgPerMl;
    return mlPerMin * 60;
  }
};
