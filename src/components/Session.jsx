import React, { useEffect, useState } from "react";
import { getInterview, saveInterview, syncInterviewFromServer } from "../lib/storage.js";
import { translateText } from "../lib/translate.js";
import { speak } from "../lib/speech.js";
import { getLanguage } from "../data/languages.js";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Session({ interviewId, onHome }) {
  const [interview, setInterview] = useState(null);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateAllError, setTranslateAllError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [rawQuestions, setRawQuestions] = useState("");
  const [followupDraft, setFollowupDraft] = useState("");
  const [followupTranslating, setFollowupTranslating] = useState(false);
  const [followupError, setFollowupError] = useState("");
  const [manualAnswerDraft, setManualAnswerDraft] = useState({}); // key -> text
  const [showOverview, setShowOverview] = useState(false);

  const language = getLanguage(interview?.language);

  // ---- load + persist ----
  useEffect(() => {
    const loaded = getInterview(interviewId);
    setInterview(loaded);
    // Server is the source of truth when a database is configured — refresh
    // from it once loaded, so the local cache never silently stays stale.
    syncInterviewFromServer(interviewId).then((serverCopy) => {
      if (serverCopy) setInterview(serverCopy);
    });
  }, [interviewId]);

  const update = (updater) => {
    setInterview((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveInterview(next);
      return next;
    });
  };

  // ---- translate any questions missing a translation ----
  useEffect(() => {
    if (!interview) return;
    const missing = interview.questions.filter((q) => !q.translated);
    if (missing.length === 0) return;
    setTranslatingAll(true);
    setTranslateAllError("");
    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (q) => ({
            id: q.id,
            translated: await translateText(q.en, "from-en", language),
          }))
        );
        update((prev) => ({
          ...prev,
          questions: prev.questions.map((q) => {
            const hit = results.find((r) => r.id === q.id);
            return hit ? { ...q, translated: hit.translated } : q;
          }),
        }));
      } catch (err) {
        console.error("Failed to translate questions:", err);
        setTranslateAllError(
          "Translation failed — check your connection or API key."
        );
      } finally {
        setTranslatingAll(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview?.id, interview?.questions?.length, interview?.language, retryTick]);

  if (!interview) {
    return (
      <div className="it-card">
        <p className="it-hint">Interview not found.</p>
        <button className="it-btn it-btn-ghost" onClick={onHome}>← Back home</button>
      </div>
    );
  }

  const idx = interview.currentIndex;
  const currentQ = interview.questions[idx];
  const currentBlock = interview.blocks[idx] || {
    questionId: currentQ?.id,
    questionEn: currentQ?.en,
    questionTranslated: currentQ?.translated,
    answerNative: "",
    answerEn: "",
    followups: [],
  };

  const ensureBlockAt = (index) => {
    update((prev) => {
      if (prev.blocks[index]) return prev;
      const q = prev.questions[index];
      const blocks = [...prev.blocks];
      blocks[index] = {
        questionId: q.id,
        questionEn: q.en,
        questionTranslated: q.translated,
        answerNative: "",
        answerEn: "",
        followups: [],
      };
      return { ...prev, blocks };
    });
  };

  const goTo = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= interview.questions.length) return;
    ensureBlockAt(nextIndex);
    update((prev) => ({ ...prev, currentIndex: nextIndex }));
  };

  const ANSWER_TRANSLATE_ERROR = "⚠ Translation failed — check your connection or API key.";

  const commitAnswer = async (target, answerNative) => {
    ensureBlockAt(target.index);
    if (target.kind === "main") {
      update((prev) => {
        const blocks = [...prev.blocks];
        blocks[target.index] = { ...blocks[target.index], answerNative, answerEn: "…translating…" };
        return { ...prev, blocks };
      });
      try {
        const answerEn = await translateText(answerNative, "to-en", language);
        update((prev) => {
          const blocks = [...prev.blocks];
          blocks[target.index] = { ...blocks[target.index], answerEn };
          return { ...prev, blocks };
        });
      } catch (err) {
        console.error("Failed to translate answer:", err);
        update((prev) => {
          const blocks = [...prev.blocks];
          blocks[target.index] = { ...blocks[target.index], answerEn: ANSWER_TRANSLATE_ERROR };
          return { ...prev, blocks };
        });
      }
    } else {
      update((prev) => {
        const blocks = [...prev.blocks];
        const followups = blocks[target.index].followups.map((f) =>
          f.id === target.followupId ? { ...f, answerNative, answerEn: "…translating…" } : f
        );
        blocks[target.index] = { ...blocks[target.index], followups };
        return { ...prev, blocks };
      });
      try {
        const answerEn = await translateText(answerNative, "to-en", language);
        update((prev) => {
          const blocks = [...prev.blocks];
          const followups = blocks[target.index].followups.map((f) =>
            f.id === target.followupId ? { ...f, answerEn } : f
          );
          blocks[target.index] = { ...blocks[target.index], followups };
          return { ...prev, blocks };
        });
      } catch (err) {
        console.error("Failed to translate follow-up answer:", err);
        update((prev) => {
          const blocks = [...prev.blocks];
          const followups = blocks[target.index].followups.map((f) =>
            f.id === target.followupId ? { ...f, answerEn: ANSWER_TRANSLATE_ERROR } : f
          );
          blocks[target.index] = { ...blocks[target.index], followups };
          return { ...prev, blocks };
        });
      }
    }
  };

  const submitManualAnswer = async (target, key) => {
    const text = (manualAnswerDraft[key] || "").trim();
    if (!text) return;
    setManualAnswerDraft((prev) => ({ ...prev, [key]: "" }));
    await commitAnswer(target, text);
  };

  // ---- ad-hoc follow-ups (attached to the current planned question) ----
  const addFollowup = async () => {
    if (!followupDraft.trim()) return;
    const en = followupDraft.trim();
    setFollowupDraft("");
    setFollowupTranslating(true);
    setFollowupError("");
    ensureBlockAt(idx);
    const followupId = uid();
    update((prev) => {
      const blocks = [...prev.blocks];
      blocks[idx] = {
        ...blocks[idx],
        followups: [...blocks[idx].followups, { id: followupId, en, translated: "…", answerNative: "", answerEn: "" }],
      };
      return { ...prev, blocks };
    });
    try {
      const translated = await translateText(en, "from-en", language);
      update((prev) => {
        const blocks = [...prev.blocks];
        const followups = blocks[idx].followups.map((f) => (f.id === followupId ? { ...f, translated } : f));
        blocks[idx] = { ...blocks[idx], followups };
        return { ...prev, blocks };
      });
      speak(translated, language.ttsLang);
    } catch (err) {
      console.error("Failed to translate follow-up:", err);
      setFollowupError("Translation failed — check your connection or API key.");
      update((prev) => {
        const blocks = [...prev.blocks];
        const followups = blocks[idx].followups.filter((f) => f.id !== followupId);
        blocks[idx] = { ...blocks[idx], followups };
        return { ...prev, blocks };
      });
      setFollowupDraft(en);
    } finally {
      setFollowupTranslating(false);
    }
  };

  // ---- edit question list (only before any answers exist) ----
  const canEditQuestions = interview.blocks.every((b) => !b || (!b.answerNative && b.followups.length === 0));

  const openEditor = () => {
    setRawQuestions(interview.questions.map((q) => q.en).join("\n"));
    setEditingQuestions(true);
  };

  const saveEditor = () => {
    const lines = rawQuestions.split("\n").map((l) => l.trim()).filter(Boolean);
    update((prev) => ({
      ...prev,
      questions: lines.map((en, i) => ({ id: `q${i}`, section: prev.questions[i]?.section || "", en, translated: "" })),
      blocks: [],
      currentIndex: 0,
    }));
    setEditingQuestions(false);
  };

  // ---- transcript download ----
  const downloadTranscript = () => {
    const header = [
      `INTERVIEW: ${interview.name}`,
      interview.interviewee && `Interviewee: ${interview.interviewee}`,
      interview.location && `Location: ${interview.location}`,
      `Date: ${interview.date}`,
      `Language: ${language.label}`,
      "=".repeat(48),
      "",
    ].filter(Boolean);

    const lines = [];
    interview.blocks.forEach((block, i) => {
      if (!block) return;
      const q = interview.questions[i];
      lines.push(`[${i + 1}] ${q.section ? `(${q.section}) ` : ""}QUESTION`);
      lines.push(`EN: ${block.questionEn}`);
      lines.push(`${language.label.toUpperCase()}: ${block.questionTranslated}`);
      if (block.answerNative) {
        lines.push(`ANSWER (${language.label}): ${block.answerNative}`);
        lines.push(`ANSWER (EN): ${block.answerEn}`);
      }
      (block.followups || []).forEach((f) => {
        lines.push(`  ↳ FOLLOW-UP`);
        lines.push(`  EN: ${f.en}`);
        lines.push(`  ${language.label.toUpperCase()}: ${f.translated}`);
        if (f.answerNative) {
          lines.push(`  ANSWER (${language.label}): ${f.answerNative}`);
          lines.push(`  ANSWER (EN): ${f.answerEn}`);
        }
      });
      lines.push("");
    });

    const blob = new Blob([header.join("\n") + lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${interview.name.replace(/[^a-z0-9]+/gi, "-")}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="it-topbar">
        <div>
          <div className="it-eyebrow">Field Interpreter · EN ⇄ {language.label}</div>
          <h1 className="it-title" style={{ fontSize: 22, marginBottom: 0 }}>{interview.name}</h1>
        </div>
        <div className="it-btnrow" style={{ marginTop: 0 }}>
          <button className="it-small-link" onClick={onHome}>← Home</button>
          <button className="it-btn it-btn-ghost" onClick={() => setShowOverview((v) => !v)}>
            {showOverview ? "Back to question" : "View all questions"}
          </button>
          <button className="it-btn it-btn-ghost" onClick={downloadTranscript}>
            Download transcript
          </button>
        </div>
      </div>

      {language.support !== "solid" && (
        <p className="it-mic-warning">
          {language.support === "unreliable"
            ? `Most browsers don't ship a built-in voice for ${language.label} — question playback may not work; typed answers below will.`
            : `${language.label} voice playback support varies by browser and OS.`}
        </p>
      )}

      {showOverview ? (
        <div className="it-card">
          <span className="it-label">All questions</span>
          {(() => {
            const sections = [];
            interview.questions.forEach((question, i) => {
              const last = sections[sections.length - 1];
              if (!last || last.section !== question.section) {
                sections.push({ section: question.section, items: [] });
              }
              sections[sections.length - 1].items.push({ question, i });
            });
            return sections.map((group) => (
              <div key={group.section} className="it-overview-group">
                <div className="it-section-tag" style={{ marginBottom: 6 }}>{group.section}</div>
                {group.items.map(({ question, i }) => {
                  const answered = !!(interview.blocks[i] && interview.blocks[i].answerNative);
                  return (
                    <button
                      key={question.id}
                      className={`it-overview-row${question.important ? " it-overview-row-important" : ""}`}
                      onClick={() => {
                        ensureBlockAt(i);
                        update((prev) => ({ ...prev, currentIndex: i }));
                        setShowOverview(false);
                      }}
                    >
                      <span className="it-overview-num">{i + 1}</span>
                      <span className="it-overview-text">
                        {question.important && <span className="it-important-mark" title="Important">★</span>}
                        {question.en}
                        {question.note && <span className="it-note">{question.note}</span>}
                      </span>
                      <span className={`it-overview-status ${answered ? "it-status-done" : "it-status-pending"}`}>
                        {answered ? "✓" : "○"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      ) : editingQuestions ? (
        <div className="it-card">
          <span className="it-label">Question order (one per line)</span>
          <textarea
            className="it-textarea"
            rows={10}
            value={rawQuestions}
            onChange={(e) => setRawQuestions(e.target.value)}
          />
          <div className="it-btnrow">
            <button className="it-btn it-btn-primary" onClick={saveEditor}>Save &amp; re-translate</button>
            <button className="it-btn it-btn-ghost" onClick={() => setEditingQuestions(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className={`it-card${currentQ?.important ? " it-card-important" : ""}`}>
          {translatingAll ? (
            <p className="it-hint">Translating…</p>
          ) : translateAllError ? (
            <div>
              <p className="it-error">{translateAllError}</p>
              <button className="it-btn it-btn-primary" onClick={() => setRetryTick((n) => n + 1)}>
                Retry
              </button>
            </div>
          ) : currentQ ? (
            <>
              <div className="it-progress">
                <span>
                  <span className="it-tab-num">{idx + 1} / {interview.questions.length}</span>
                  <span className="it-section-tag">{currentQ.section}</span>
                </span>
                {canEditQuestions && (
                  <button className="it-small-link" onClick={openEditor}>Edit question list</button>
                )}
              </div>

              {currentQ.important && (
                <div className="it-important-banner">
                  <span className="it-important-mark" title="Important">★</span> Important question
                </div>
              )}
              <div className="it-q-en"><span className="it-lang-pill it-pill-en">EN</span>{currentQ.en}</div>
              {currentQ.note && <p className="it-note">{currentQ.note}</p>}
              <div className="it-q-es">
                <span className="it-lang-pill it-pill-es">{language.code.toUpperCase()}</span>
                {currentQ.translated || "…"}
              </div>

              <div className="it-btnrow">
                <button className="it-btn it-btn-teal" onClick={() => speak(currentQ.translated, language.ttsLang)} disabled={!currentQ.translated}>
                  🔊 Play question in {language.label}
                </button>
              </div>

              {currentBlock.answerNative && (
                <div className="it-answer-box">
                  <div className="it-answer-en">{currentBlock.answerEn}</div>
                  <div className="it-answer-es">{currentBlock.answerNative}</div>
                </div>
              )}

              <div className="it-manual-row">
                <input
                  className="it-input"
                  placeholder={`Type the answer in ${language.label}…`}
                  value={manualAnswerDraft["main"] || ""}
                  onChange={(e) => setManualAnswerDraft((prev) => ({ ...prev, main: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && submitManualAnswer({ index: idx, kind: "main" }, "main")}
                />
                <button className="it-btn it-btn-dark" onClick={() => submitManualAnswer({ index: idx, kind: "main" }, "main")}>
                  Add
                </button>
              </div>

              {/* Ad-hoc follow-ups tied to this planned question */}
              <div className="it-followups">
                <span className="it-label">Ad-hoc follow-ups for this question</span>
                {currentBlock.followups.map((f) => {
                  const key = `f-${f.id}`;
                  return (
                    <div className="it-followup-item" key={f.id}>
                      <span className="it-followup-tag">Follow-up</span>
                      <div className="it-q-en" style={{ marginBottom: 4 }}>
                        <span className="it-lang-pill it-pill-en">EN</span>{f.en}
                      </div>
                      <div className="it-q-es" style={{ fontSize: 16 }}>
                        <span className="it-lang-pill it-pill-es">{language.code.toUpperCase()}</span>{f.translated}
                      </div>
                      <div className="it-btnrow" style={{ marginTop: 8 }}>
                        <button className="it-btn it-btn-teal" onClick={() => speak(f.translated, language.ttsLang)}>
                          🔊 Play
                        </button>
                      </div>
                      {f.answerNative && (
                        <div className="it-answer-box">
                          <div className="it-answer-en">{f.answerEn}</div>
                          <div className="it-answer-es">{f.answerNative}</div>
                        </div>
                      )}
                      <div className="it-manual-row">
                        <input
                          className="it-input"
                          placeholder={`Type the answer in ${language.label}…`}
                          value={manualAnswerDraft[key] || ""}
                          onChange={(e) => setManualAnswerDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            submitManualAnswer({ index: idx, kind: "followup", followupId: f.id }, key)
                          }
                        />
                        <button
                          className="it-btn it-btn-dark"
                          onClick={() => submitManualAnswer({ index: idx, kind: "followup", followupId: f.id }, key)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="it-manual-row">
                  <input
                    className="it-input"
                    placeholder="Type a follow-up question in English…"
                    value={followupDraft}
                    onChange={(e) => setFollowupDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFollowup()}
                  />
                  <button className="it-btn it-btn-dark" onClick={addFollowup} disabled={followupTranslating}>
                    {followupTranslating ? "…" : "Add & ask"}
                  </button>
                </div>
                {followupError && <p className="it-error">{followupError}</p>}
              </div>

              <div className="it-nav">
                <button className="it-btn it-btn-ghost" onClick={() => goTo(idx - 1)} disabled={idx === 0}>
                  ← Previous
                </button>
                <span className="it-nav-dots">
                  {interview.questions.map((_, i) => (i === idx ? "●" : "○")).join(" ")}
                </span>
                {idx < interview.questions.length - 1 ? (
                  <button className="it-btn it-btn-ghost" onClick={() => goTo(idx + 1)}>Next →</button>
                ) : (
                  <button className="it-btn it-btn-primary" onClick={onHome}>Finish interview</button>
                )}
              </div>
            </>
          ) : (
            <p className="it-hint">No questions yet.</p>
          )}
        </div>
      )}
    </>
  );
}
