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

export function listInterviews() {
  const ids = readIndex();
  const items = ids
    .map((id) => getInterview(id))
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return items;
}

export function getInterview(id) {
  try {
    const raw = localStorage.getItem(ITEM_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveInterview(interview) {
  const updated = { ...interview, updatedAt: Date.now() };
  localStorage.setItem(ITEM_PREFIX + updated.id, JSON.stringify(updated));
  const ids = readIndex();
  if (!ids.includes(updated.id)) writeIndex([updated.id, ...ids]);
  return updated;
}

export function deleteInterview(id) {
  localStorage.removeItem(ITEM_PREFIX + id);
  writeIndex(readIndex().filter((existingId) => existingId !== id));
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
      translated: defaultTranslations[language || "es"]?.[q.id] || "",
    })),
    currentIndex: 0,
    blocks: [],
  };
  return saveInterview(interview);
}
