// A ~0.2s silent WAV, used purely to nudge iOS Safari into the "playback"
// audio session category before any speechSynthesis call — see unlockAudio()
// below for why. Generated as 8kHz mono 8-bit PCM, all samples at the silent
// midpoint (128), so it's inaudible even if a browser ever actually plays it.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

let unlocked = false;
let unlockAudioEl = null;

// iOS Safari sometimes routes speechSynthesis audio to the phone's built-in
// speaker instead of a connected Bluetooth device, even when a real <audio>/
// <video> element on the same page correctly routes to Bluetooth. Playing a
// silent real audio element, synchronously inside a user gesture, tends
// to push the page's audio session into the "playback" category that
// speechSynthesis otherwise doesn't reliably establish on its own — Bluetooth
// output then tends to follow that session.
//
// iOS re-evaluates the audio output route whenever the session goes idle, so
// a one-shot unlock loses its effect between speak() calls. The element is
// therefore looped for as long as the interview session is active (started
// on the first user gesture, stopped via stopAudioUnlock() when the Session
// view unmounts) to keep the audio session continuously alive. Volume is
// near-zero rather than muted because muted tracks don't reliably hold the
// session open on iOS.
//
// This is a known-inconsistent iOS platform quirk (varies by iOS version and
// isn't documented/guaranteed by Apple), not a confirmed fix — see the
// "Known limitations" note in README.md.
function unlockAudio() {
  if (unlocked || typeof window === "undefined" || typeof Audio === "undefined") return;
  unlocked = true; // mark used immediately so this only ever starts once per session
  try {
    unlockAudioEl = new Audio(SILENT_WAV);
    unlockAudioEl.loop = true;
    unlockAudioEl.volume = 0.01;
    unlockAudioEl.play().catch(() => {}); // ignore rejection — best-effort only
  } catch {
    // best-effort only — speak() still proceeds normally either way
  }
}

// Stops and releases the looping unlock element. Call this when the
// interview session ends (or its view unmounts) so the audio session doesn't
// stay "live" — and the loop doesn't keep draining battery — once the
// interviewer has left the Session view.
export function stopAudioUnlock() {
  if (unlockAudioEl) {
    try {
      unlockAudioEl.pause();
      unlockAudioEl.src = "";
    } catch {
      // best-effort cleanup only
    }
    unlockAudioEl = null;
  }
  unlocked = false;
}

export function speak(text, lang) {
  if (!window.speechSynthesis || !text) return;

  // Must run synchronously inside the same user-gesture call stack as the
  // speak() call (i.e. don't await anything before this) for iOS to treat
  // both as part of the same gesture-triggered audio session.
  unlockAudio();

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}
