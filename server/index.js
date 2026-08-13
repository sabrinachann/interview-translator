import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { translateOne } from "./translateCore.js";
import {
  dbEnabled,
  initDb,
  listInterviewsDb,
  getInterviewDb,
  saveInterviewDb,
  deleteInterviewDb,
  pingDb,
} from "./db.js";

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

// Lets the client show an honest "backed up" vs "local only" status instead
// of silently assuming server-side persistence works.
app.get("/api/health", async (req, res) => {
  if (!dbEnabled) return res.json({ dbConfigured: false, dbConnected: false });
  try {
    await pingDb();
    res.json({ dbConfigured: true, dbConnected: true });
  } catch (err) {
    console.error("Health check DB ping failed:", err);
    res.json({ dbConfigured: true, dbConnected: false });
  }
});

// ---- interview persistence (source of truth when a database is configured;
// the client falls back to its localStorage cache if these 503) ----
app.get("/api/interviews", async (req, res) => {
  if (!dbEnabled) return res.status(503).json({ error: "No database configured" });
  try {
    res.json({ interviews: await listInterviewsDb() });
  } catch (err) {
    console.error("Failed to list interviews:", err);
    res.status(500).json({ error: "Failed to list interviews" });
  }
});

app.get("/api/interviews/:id", async (req, res) => {
  if (!dbEnabled) return res.status(503).json({ error: "No database configured" });
  try {
    const interview = await getInterviewDb(req.params.id);
    if (!interview) return res.status(404).json({ error: "Not found" });
    res.json({ interview });
  } catch (err) {
    console.error("Failed to get interview:", err);
    res.status(500).json({ error: "Failed to get interview" });
  }
});

app.put("/api/interviews/:id", async (req, res) => {
  if (!dbEnabled) return res.status(503).json({ error: "No database configured" });
  try {
    const interview = { ...req.body, id: req.params.id };
    res.json({ interview: await saveInterviewDb(interview) });
  } catch (err) {
    console.error("Failed to save interview:", err);
    res.status(500).json({ error: "Failed to save interview" });
  }
});

app.delete("/api/interviews/:id", async (req, res) => {
  if (!dbEnabled) return res.status(503).json({ error: "No database configured" });
  try {
    await deleteInterviewDb(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete interview:", err);
    res.status(500).json({ error: "Failed to delete interview" });
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
initDb()
  .then(() => {
    if (!dbEnabled) {
      console.log("No DATABASE_URL set — interviews will only be saved in the browser's localStorage.");
    }
    app.listen(PORT, () => {
      console.log(`Translator API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    app.listen(PORT, () => {
      console.log(`Translator API listening on http://localhost:${PORT} (database unavailable)`);
    });
  });
