// One-time (re-run-on-change) script: translates every question in
// src/data/defaultQuestions.js into every language in src/data/languages.js
// and writes the results to src/data/defaultTranslations.json.
//
// Run with: npm run pretranslate
// Re-run whenever defaultQuestions.js or languages.js changes.
import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { defaultQuestions } from "../src/data/defaultQuestions.js";
import { LANGUAGES } from "../src/data/languages.js";
import { translateOne } from "../server/translateCore.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "src", "data", "defaultTranslations.json");

const API_KEY = process.env.ANTHROPIC_API_KEY;

async function main() {
  if (!API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY — set it in your .env file first.");
    process.exit(1);
  }

  const result = {};

  for (const language of LANGUAGES) {
    console.log(`Translating ${defaultQuestions.length} questions into ${language.label}...`);
    result[language.code] = {};
    for (const q of defaultQuestions) {
      try {
        const translated = await translateOne({
          text: q.en,
          direction: "from-en",
          lang: language.code,
          langLabel: language.label,
          apiKey: API_KEY,
        });
        result[language.code][q.id] = translated;
        process.stdout.write(".");
      } catch (err) {
        console.error(`\nFailed to translate "${q.en}" into ${language.label}: ${err.message}`);
        process.exit(1);
      }
    }
    process.stdout.write("\n");
  }

  await writeFile(OUT_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_PATH}`);
}

main();
