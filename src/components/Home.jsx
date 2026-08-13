import React, { useEffect, useState } from "react";
import { listInterviews, createInterview, deleteInterview } from "../lib/storage.js";
import { LANGUAGES, getLanguage } from "../data/languages.js";

export default function Home({ onOpen }) {
  const [interviews, setInterviews] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    interviewee: "",
    location: "",
    date: new Date().toISOString().slice(0, 10),
    language: "es",
  });

  const refresh = () => setInterviews(listInterviews());
  useEffect(refresh, []);

  const handleCreate = () => {
    const interview = createInterview(form);
    refresh();
    onOpen(interview.id);
  };

  const handleDelete = (id) => {
    if (!confirm("Delete this interview? This can't be undone.")) return;
    deleteInterview(id);
    refresh();
  };

  const progressLabel = (interview) => {
    const answered = (interview.blocks || []).filter((b) => b && b.answerNative).length;
    const total = interview.questions.length;
    const lang = getLanguage(interview.language).label;
    return `${answered} of ${total} answered · ${lang}`;
  };

  return (
    <>
      <div className="it-eyebrow">Field Interpreter · EN ⇄ ES</div>
      <h1 className="it-title">Interview Translator</h1>
      <p className="it-sub">
        Start a new interview or pick up where you left off. Every interview
        keeps its own transcript, saved on this device.
      </p>

      <div className="it-card">
        {!showForm ? (
          <button className="it-btn it-btn-primary" onClick={() => setShowForm(true)}>
            + New interview
          </button>
        ) : (
          <>
            <span className="it-label">New interview</span>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                className="it-input"
                placeholder="Interview name (e.g. Interview #4)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="it-input"
                placeholder="Interviewee (optional)"
                value={form.interviewee}
                onChange={(e) => setForm({ ...form, interviewee: e.target.value })}
              />
              <input
                className="it-input"
                placeholder="Location (optional)"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <input
                className="it-input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <select
                className="it-input"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                    {l.support !== "solid" ? " (limited voice/mic support)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="it-btnrow">
              <button className="it-btn it-btn-primary" onClick={handleCreate}>
                Create &amp; start
              </button>
              <button className="it-btn it-btn-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
            <p className="it-hint">
              The default question set (Peddlers Questionnaire) loads
              automatically — you can edit it inside the interview before you
              start recording answers.
            </p>
          </>
        )}
      </div>

      <div className="it-card">
        <span className="it-label">Your interviews</span>
        {interviews.length === 0 && (
          <p className="it-empty">No interviews yet — create one above to get started.</p>
        )}
        {interviews.map((interview) => (
          <div className="it-home-row" key={interview.id}>
            <div>
              <div className="it-home-name">{interview.name}</div>
              <div className="it-home-meta">
                {[interview.interviewee, interview.location, interview.date]
                  .filter(Boolean)
                  .join(" · ")}
                {" — "}
                {progressLabel(interview)}
              </div>
            </div>
            <div className="it-home-actions">
              <button className="it-btn it-btn-ghost" onClick={() => onOpen(interview.id)}>
                Open
              </button>
              <button className="it-small-link" onClick={() => handleDelete(interview.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
