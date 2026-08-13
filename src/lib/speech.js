export function speak(text, lang) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const micSupported = !!SpeechRecognitionAPI;

// Returns a controller: { stop() }. Callbacks: onInterim(text), onFinal(text), onError(err)
export function startListening({ lang = "es-ES", onInterim, onFinal, onError }) {
  if (!SpeechRecognitionAPI) {
    onError && onError(new Error("Speech recognition isn't supported in this browser."));
    return { stop() {} };
  }
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;

  let finalText = "";
  let stoppedManually = false;

  recognition.onresult = (event) => {
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += transcript + " ";
      else interimText += transcript;
    }
    onInterim && onInterim(interimText);
  };

  recognition.onerror = (event) => {
    // "no-speech" and "aborted" fire often on normal stop() calls — don't
    // surface those as hard errors, just let onend finish the flow.
    if (event.error !== "no-speech" && event.error !== "aborted") {
      onError && onError(new Error(mapSpeechError(event.error)));
    }
  };

  recognition.onend = () => {
    onFinal && onFinal(finalText.trim());
  };

  try {
    recognition.start();
  } catch (err) {
    onError && onError(err);
  }

  return {
    stop() {
      if (stoppedManually) return;
      stoppedManually = true;
      recognition.stop();
    },
  };
}

function mapSpeechError(code) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Allow microphone access for this site and try again.";
    case "audio-capture":
      return "No microphone was found. Check your device's audio input.";
    case "network":
      return "A network error interrupted speech recognition. Try again.";
    default:
      return `Speech recognition error: ${code}`;
  }
}
