import { defaultQuestions } from "../data/defaultQuestions.js";
import defaultTranslations from "../data/defaultTranslations.json";

const INDEX_KEY = "it:index";
const ITEM_PREFIX = "it:interview:";
const uid = () => Math.random().toString(36).slice(2, 10);

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeIndex(ids) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

// ---- local cache (always used for instant reads; may be stale until synced) ----
function writeLocal(interview) {
  localStorage.setItem(ITEM_PREFIX + interview.id, JSON.stringify(interview));
  const ids = readIndex();
  if (!ids.includes(interview.id)) writeIndex([interview.id, ...ids]);
  return interview;
}

function removeLocal(id) {
  localStorage.removeItem(ITEM_PREFIX + id);
  writeIndex(readIndex().filter((existingId) => existingId !== id));
}

export function listInterviews() {
  const ids = readIndex();
  return ids
    .map((id) => getInterview(id))
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getInterview(id) {
  try {
    const raw = localStorage.getItem(ITEM_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Writes the fast local cache immediately, then fires an async sync to the
// server (source of truth, when a database is configured — see server/db.js).
// The server call is fire-and-forget so callers that don't await this keep
// working exactly as before if the server is unreachable or has no database.
export function saveInterview(interview) {
  const updated = { ...interview, updatedAt: Date.now() };
  writeLocal(updated);
  fetch(`/api/interviews/${updated.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  }).catch((err) => console.error("Failed to sync interview to server:", err));
  return updated;
}

export function deleteInterview(id) {
  removeLocal(id);
  fetch(`/api/interviews/${id}`, { method: "DELETE" }).catch((err) =>
    console.error("Failed to delete interview on server:", err)
  );
}

export function createInterview({ name, interviewee, location, date, language }) {
  const id = uid();
  const interview = {
    id,
    name: name || "Untitled interview",
    interviewee: interviewee || "",
    location: location || "",
    date: date || new Date().toISOString().slice(0, 10),
    language: language || "es",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questions: defaultQuestions.map((q) => ({
      ...q,
      translated: language === "en" ? q.en : defaultTranslations[language || "es"]?.[q.id] || "",
    })),
    currentIndex: 0,
    blocks: [],
  };
  return saveInterview(interview);
}

// ---- server sync (source of truth when DATABASE_URL is configured server-side;
// silently no-ops if the endpoint 503s, so the app keeps working from
// localStorage alone exactly like before a database was added) ----
export async function syncInterviewsFromServer() {
  try {
    const res = await fetch("/api/interviews");
    if (!res.ok) return null;
    const { interviews } = await res.json();
    interviews.forEach(writeLocal);
    return interviews;
  } catch (err) {
    console.error("Failed to sync interview list from server:", err);
    return null;
  }
}

export async function syncInterviewFromServer(id) {
  try {
    const res = await fetch(`/api/interviews/${id}`);
    if (!res.ok) return null;
    const { interview } = await res.json();
    if (interview) writeLocal(interview);
    return interview;
  } catch (err) {
    console.error("Failed to sync interview from server:", err);
    return null;
  }
}
