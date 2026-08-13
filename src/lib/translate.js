// direction: "from-en" (English -> target language) or "to-en" (target language -> English)
export async function translateText(text, direction, language) {
  if (language.code === "en") return text; // English interview — nothing to translate.

  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      direction,
      lang: language.code,
      langLabel: language.label,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`Translate request failed: ${res.status} ${res.statusText}`, body);
    throw new Error(body.error || "Translation failed");
  }
  const data = await res.json();
  return data.translation;
}
