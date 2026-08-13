import { defaultQuestions } from "../data/defaultQuestions.js";
import defaultTranslations from "../data/defaultTranslations.json";

const INDEX_KEY = "it:index";
const ITEM_PREFIX = "it:interview:";
const FETCH_TIMEOUT_MS = 8000;
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

// Aborts if the server doesn't answer promptly, so a hung request can't leave
// the caller waiting forever — but never throws in a way callers forget to
// catch; fetchWithTimeout's rejections are always caught by its callers below.
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
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
// `keepalive` gives the request a real chance to finish even if the tab is
// backgrounded or closed right after this call (e.g. closing Safari on iOS
// right after typing an answer) — without it, that request would simply be
// aborted mid-flight and the edit would never reach the server. The request
// is still fire-and-forget: any failure here only means the next sync won't
// see this edit yet, it never touches or corrupts the local copy just written.
export function saveInterview(interview) {
  const updated = { ...interview, updatedAt: Date.now() };
  writeLocal(updated);
  try {
    fetch(`/api/interviews/${updated.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
      keepalive: true,
    }).catch((err) => console.error("Failed to sync interview to server (local copy kept):", err));
  } catch (err) {
    // keepalive requests throw synchronously if the body exceeds the browser's
    // keepalive size limit (~64KB) — fall back to a normal fire-and-forget PUT.
    fetch(`/api/interviews/${updated.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch((err2) => console.error("Failed to sync interview to server (local copy kept):", err2));
  }
  return updated;
}

export function deleteInterview(id) {
  removeLocal(id);
  fetch(`/api/interviews/${id}`, { method: "DELETE", keepalive: true }).catch((err) =>
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

// ---- server sync ----
// The server is treated as an *additional* copy, never as ground truth that's
// allowed to erase what's on the device: a failed/empty/stale response must
// never delete or downgrade local data. Only a strictly newer `updatedAt` from
// the server is allowed to overwrite a local record, and a missing server
// record is never taken to mean "delete this locally" — only an explicit
// deleteInterview() call removes anything from local storage.
function mergeServerInterview(serverInterview) {
  if (!serverInterview || !serverInterview.id) return null;
  const local = getInterview(serverInterview.id);
  if (!local || (serverInterview.updatedAt || 0) > (local.updatedAt || 0)) {
    writeLocal(serverInterview);
    return serverInterview;
  }
  return null; // local is already current (or newer) — leave it alone
}

// Returns true if any local interview was actually updated from the server,
// false if the server was unreachable, errored, or had nothing newer.
export async function syncInterviewsFromServer() {
  let res;
  try {
    res = await fetchWithTimeout("/api/interviews");
  } catch (err) {
    console.error("Couldn't reach server to sync interviews — keeping local data as-is:", err);
    return false;
  }
  if (!res.ok) {
    // Includes the 503 "no database configured" case — nothing to sync from,
    // so leave local data untouched rather than treating it as "empty".
    if (res.status !== 503) console.error(`Interview list sync failed (HTTP ${res.status}) — keeping local data as-is.`);
    return false;
  }
  let body;
  try {
    body = await res.json();
  } catch (err) {
    console.error("Server returned an unreadable interview list — keeping local data as-is:", err);
    return false;
  }
  const interviews = Array.isArray(body.interviews) ? body.interviews : [];
  let changed = false;
  for (const serverInterview of interviews) {
    if (mergeServerInterview(serverInterview)) changed = true;
  }
  return changed;
}

// Returns the merged interview if the server had a strictly newer copy,
// otherwise null (server unreachable, errored, 404, or not newer) — callers
// should only update on-screen state when this returns non-null.
export async function syncInterviewFromServer(id) {
  let res;
  try {
    res = await fetchWithTimeout(`/api/interviews/${id}`);
  } catch (err) {
    console.error("Couldn't reach server to sync this interview — keeping local data as-is:", err);
    return null;
  }
  if (!res.ok) {
    if (res.status !== 503 && res.status !== 404) {
      console.error(`Interview sync failed (HTTP ${res.status}) — keeping local data as-is.`);
    }
    return null;
  }
  let body;
  try {
    body = await res.json();
  } catch (err) {
    console.error("Server returned an unreadable interview — keeping local data as-is:", err);
    return null;
  }
  return mergeServerInterview(body.interview);
}

// Whether server-side backup is actually configured and reachable right now —
// used to show an honest status indicator instead of silently assuming it works.
export async function checkServerHealth() {
  try {
    const res = await fetchWithTimeout("/api/health");
    if (!res.ok) return { dbConfigured: false, dbConnected: false };
    return await res.json();
  } catch (err) {
    return { dbConfigured: false, dbConnected: false };
  }
}
