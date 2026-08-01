/* ==========================================================================
   VOICE.JS — Web Speech API wrapper
   Handles browser autoplay policies — must be called from direct user gesture.
   ========================================================================== */

"use strict";

const Voice = (() => {
  const synth = window.speechSynthesis;
  let enabled = true;
  let resumed = false;

  /* Some browsers (iOS especially) need a speak() call inside a user gesture
     to "unlock" the synth. Call this once from the first tap. */
  function unlock() {
    if (resumed || !synth) return;
    resumed = true;
    try {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      synth.speak(u);
      synth.cancel();
    } catch (_) { /* ignore */ }
  }

  function speak(text) {
    if (!enabled || !synth) return;
    unlock();
    // Some browsers pause synth after ~15s of silence — resume before speaking
    try { synth.resume(); } catch (_) { /* ignore */ }
    synth.cancel();
    // Small delay lets cancel() finish before new utterance
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1;
      u.volume = 1;
      u.onerror = () => { /* silently ignore speech errors */ };
      synth.speak(u);
    }, 50);
  }

  function stop() { synth?.cancel(); }
  function setEnabled(v) { enabled = v; if (!v) stop(); }
  function isEnabled() { return enabled; }

  return { speak, stop, setEnabled, isEnabled, unlock };
})();
