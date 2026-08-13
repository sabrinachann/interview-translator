// Shared translation logic used by both the live /api/translate route
// (server/index.js) and the one-time pretranslate script (scripts/pretranslate.js).
// Keep LANGUAGE_NOTES in sync with src/data/languages.js.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export const LANGUAGE_NOTES = {
  es: 'Plain, everyday Latin American Spanish — not Spain/Castilian ("vosotros", "coger" for "grab"). Use "agarrar" or "recoger" instead. Address the person as "usted".',
  zh: "Plain spoken Mandarin, simplified characters, everyday vocabulary — avoid formal or literary phrasing.",
  yue: "Plain spoken Cantonese as used in NYC Chinatown communities, traditional characters, everyday vocabulary — avoid formal/literary phrasing.",
  ht: "Plain, everyday Haitian Creole.",
  bn: "Plain, everyday spoken Bengali, common script — avoid literary/formal register.",
  ar: "Plain spoken Arabic in a widely understood everyday register, not formal Modern Standard Arabic.",
  ru: "Plain, everyday spoken Russian.",
};

export function buildSystemPrompt(langCode, langLabel, toEnglish) {
  const notes = LANGUAGE_NOTES[langCode] || "Plain, everyday, conversational register.";
  if (toEnglish) {
    return `You translate spoken, informal ${langLabel} into natural, plain English. The
speaker may be an informal scrap-metal collector, canner, or scrap yard worker describing
their work. Preserve their meaning and tone without formalizing it. Register notes: ${notes}
Respond with ONLY the English translation and nothing else — no notes, no quotation marks.`;
  }
  return `You translate interview questions from English into ${langLabel} for a field
researcher interviewing informal scrap-metal collectors, canners, and scrap yard workers,
some of whom are homeless. Keep sentences short and conversational, the way someone would
actually ask a stranger on the street — never bureaucratic, academic, or technical. Register
notes: ${notes} Respond with ONLY the ${langLabel} translation and nothing else — no notes,
no quotation marks.`;
}

// Throws on failure — callers decide how to surface that (HTTP error vs script abort).
export async function translateOne({ text, direction, lang, langLabel, apiKey }) {
  if (lang === "en") return text; // English interview — nothing to translate.

  if (!apiKey) {
    const err = new Error("Missing ANTHROPIC_API_KEY");
    err.code = "MISSING_API_KEY";
    throw err;
  }

  const system = buildSystemPrompt(lang, langLabel || lang, direction === "to-en");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Anthropic API error ${response.status}: ${errText}`);
    err.code = "ANTHROPIC_ERROR";
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const block = (data.content || []).find((c) => c.type === "text");
  return block ? block.text.trim() : "";
}
