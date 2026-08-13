// Target languages for the interviewee's side of the conversation.
// ttsLang / sttLang are BCP-47 tags used by the browser's speech APIs —
// actual voice/recognition availability depends on the OS and browser.
export const LANGUAGES = [
  {
    code: "es",
    label: "Spanish",
    ttsLang: "es-US",
    sttLang: "es-US",
    support: "solid",
    notes:
      'Plain, everyday Latin American Spanish — not Spain/Castilian ("vosotros", "coger" for "grab"). Use "agarrar" or "recoger" instead. Address the person as "usted".',
  },
  {
    code: "zh",
    label: "Chinese (Mandarin)",
    ttsLang: "zh-CN",
    sttLang: "zh-CN",
    support: "solid",
    notes:
      "Plain spoken Mandarin, simplified characters, everyday vocabulary — avoid formal or literary phrasing.",
  },
  {
    code: "yue",
    label: "Chinese (Cantonese)",
    ttsLang: "zh-HK",
    sttLang: "zh-HK",
    support: "partial",
    notes:
      "Plain spoken Cantonese as used in NYC Chinatown communities, traditional characters, everyday vocabulary — avoid formal/literary phrasing.",
  },
  {
    code: "ht",
    label: "Haitian Creole",
    ttsLang: "ht",
    sttLang: "ht",
    support: "unreliable",
    notes: "Plain, everyday Haitian Creole.",
  },
  {
    code: "bn",
    label: "Bengali",
    ttsLang: "bn-BD",
    sttLang: "bn-BD",
    support: "partial",
    notes: "Plain, everyday spoken Bengali, common script — avoid literary/formal register.",
  },
  {
    code: "ar",
    label: "Arabic",
    ttsLang: "ar-SA",
    sttLang: "ar-SA",
    support: "solid",
    notes:
      "Plain spoken Arabic in a widely understood everyday register, not formal Modern Standard Arabic.",
  },
  {
    code: "ru",
    label: "Russian",
    ttsLang: "ru-RU",
    sttLang: "ru-RU",
    support: "solid",
    notes: "Plain, everyday spoken Russian.",
  },
];

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
