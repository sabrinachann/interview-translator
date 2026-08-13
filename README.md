# Interview Translator

A field-interview tool: work through a preset, ordered list of questions,
hear each one spoken aloud in Spanish, record the interviewee's answer, and
get it translated back into English live — with room to ask ad-hoc
follow-ups after any planned question without losing your place.

Ships with the default question set from the Peddlers Questionnaire
(scrap-metal collector interviews), pre-loaded into every new interview.

## Supported languages

Pick a language per interview at creation time (`src/data/languages.js`).
Currently: Spanish, Mandarin, Cantonese, Haitian Creole, Bengali, Arabic,
Russian. Browser voice/microphone support varies — languages flagged
"limited voice/mic support" in the dropdown fall back to a typed-answer box
that appears under every question regardless of language. Add a language by
adding one entry to `LANGUAGES` and, if its register needs different notes
than the default, one line in `LANGUAGE_NOTES` in `server/index.js`.

## What changed from the artifact version

- **Recording now works.** The old version ran inside Claude.ai's sandboxed
  artifact iframe, which has no microphone permission — the record button
  could never actually get audio. This is a normal local web app, so Chrome
  will prompt for mic access the first time, same as any site.
- **Home screen** lists every interview you've started, with a progress
  count, and lets you resume or delete one.
- **Follow-ups are attached to the question they interrupt.** Add as many
  ad-hoc follow-ups as you want right after a planned question, then move to
  the next one — the transcript preserves that order automatically instead
  of dumping follow-ups in a separate section.
- **Transcript downloads any time**, not just at the end — pulls from
  whatever's been answered so far.
- **Translation register**: Spanish is generated as plain, colloquial Latin
  American Spanish (not Spain/Castilian) aimed at an informal, possibly
  street-level audience, addressed respectfully with "usted." See
  `server/index.js` for the exact system prompt if you want to tune it
  further.
- **No API key ships in the browser.** Translation calls go through a small
  local Express server that holds your Anthropic key server-side — the
  in-browser, no-key translation trick only works inside Claude.ai's
  artifact sandbox, not in a real deployed app.

## Setup

Requires Node 18+ and an Anthropic API key (console.anthropic.com).

```bash
npm install
cp .env.example .env
# edit .env and paste your ANTHROPIC_API_KEY

npm run dev
```

This starts the Express API on `:3001` and the Vite dev server on `:5173`
(proxying `/api` to the Express server). Open **http://localhost:5173**.

For a single deployable build:

```bash
npm run build
npm start   # serves the built frontend + API from :3001 (or $PORT)
```

## Deploying (so it works on your iPhone off wifi)

Localhost only reaches devices on the same network. To use this from an iPhone
over cellular, deploy `server/index.js` (which also serves the built frontend,
see `npm start`) somewhere with a public URL.

**Recommended: Render.**  Free tier, no CLI needed, deploys straight from a
git repo, and secrets are set in a web dashboard instead of committed to `.env`.

1. Push this project to a GitHub repo (private is fine).
2. On [render.com](https://render.com), New → Web Service → connect the repo.
3. Build command: `npm install && npm run build`
   Start command: `npm start`
4. Under Environment, add `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL` if you
   override it) as secret env vars — never commit these to `.env` in git.
5. Deploy. Render gives you an `https://your-app.onrender.com` URL — open
   that on your iPhone.

Free-tier Render spins down after inactivity, so the first request after a
while takes ~30s to wake up; fine for occasional field use.

Other reasonable options, if you'd rather not use Render:
- **Railway** — similar flow (connect repo, set env vars in dashboard,
  auto-detects `npm start`), usage-based pricing instead of a spin-down free tier.
- **Fly.io** — more control (a `fly.toml` + Dockerfile-ish deploy), a bit more
  setup than the other two, but avoids Render's cold-start delay on the free tier.

Whichever you pick: put `ANTHROPIC_API_KEY` in that platform's secret/env-var
store, not in a committed file — `.env` should stay in `.gitignore` locally.

### Add to iPhone Home Screen

Once deployed, open the URL in Safari on the iPhone → Share → **Add to Home
Screen**. `public/manifest.json` and the `apple-mobile-web-app-*` tags in
`index.html` make it launch full-screen (no Safari chrome) like a native app.
The icons in `public/` are solid-color placeholders — swap
`icon-192.png` / `icon-512.png` / `apple-touch-icon.png` for real artwork
whenever you want.

### iOS and speech recognition

Safari on iOS doesn't implement the Web Speech API's `SpeechRecognition`
interface at all, so the "Record answer" button (which relies on it) never
appears there — `micSupported` in `src/lib/speech.js` already feature-detects
this per-browser. On iPhone, use the typed-answer box under each question
instead: tap it and use the keyboard's built-in dictation (microphone icon)
to fill it by voice — no in-app code needed. Playing questions aloud via
`speechSynthesis` works fine on iOS as-is.

## Project layout

```
server/index.js          Express server — the only place that holds your API key
src/data/defaultQuestions.js   Default question set (edit to change what loads for new interviews)
src/lib/translate.js     Client → /api/translate helper
src/lib/speech.js        Browser TTS (speak) + STT (startListening) wrappers
src/lib/storage.js       localStorage-backed interview persistence
src/components/Home.jsx  Interview list + creation form
src/components/Session.jsx  The interview flow itself
```

## Continuing this in Claude Code

From this folder:

```bash
claude
```

A good first prompt once you're in:

> This is a Vite + React + Express app for conducting translated field
> interviews (see README.md). Read through src/components/Session.jsx and
> src/lib/speech.js to understand the current flow before making changes.

Things worth asking Claude Code for next, if you want them:
- A typed-answer fallback for browsers/devices without mic support
- Multiple question sets to choose from at interview creation
- Audio playback of the raw recording alongside the transcript
- Exporting all interviews at once, or as a shared Google Sheet
