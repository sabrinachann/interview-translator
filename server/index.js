import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { translateOne } from "./translateCore.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const API_KEY = process.env.ANTHROPIC_API_KEY;

app.post("/api/translate", async (req, res) => {
  try {
    const { text, direction, lang, langLabel } = req.body || {};
    if (!text || !direction || !lang) {
      return res.status(400).json({ error: "Missing text, direction, or lang" });
    }
    if (!API_KEY) {
      return res
        .status(500)
        .json({ error: "Server is missing ANTHROPIC_API_KEY. Add it to your .env file." });
    }

    const translation = await translateOne({ text, direction, lang, langLabel, apiKey: API_KEY });
    res.json({ translation });
  } catch (err) {
    if (err.code === "ANTHROPIC_ERROR") {
      console.error("Anthropic API error:", err.status, err.message);
      return res.status(502).json({ error: "Translation service error" });
    }
    console.error(err);
    res.status(500).json({ error: "Translation failed" });
  }
});

// In production, serve the built frontend.
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Translator API listening on http://localhost:${PORT}`);
});
