/* ==========================================================================
   VOICE.JS — Web Speech API wrapper
   ========================================================================== */

"use strict";

const Voice = (() => {
  const synth = window.speechSynthesis;
  let enabled = true;

  function speak(text) {
    if (!enabled || !synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    synth.speak(u);
  }

  function stop() { synth?.cancel(); }
  function setEnabled(v) { enabled = v; if (!v) stop(); }
  function isEnabled() { return enabled; }

  return { speak, stop, setEnabled, isEnabled };
})();
