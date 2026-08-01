/* ==========================================================================
   VOICE.JS — Web Speech API wrapper. Silently no-ops if unsupported
   or disabled, so it's safe to call Voice.say() anywhere.
   ========================================================================== */

const Voice = {
  enabled: true,
  supported: typeof window !== "undefined" && "speechSynthesis" in window,

  say(text){
    if(!this.enabled || !this.supported || !text) return;
    try{
      window.speechSynthesis.cancel(); // don't queue/overlap on rapid steps
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch(e){ /* fail silent — never block the clinical flow */ }
  },

  setEnabled(val){
    this.enabled = val;
    if(!val && this.supported) window.speechSynthesis.cancel();
  }
};
