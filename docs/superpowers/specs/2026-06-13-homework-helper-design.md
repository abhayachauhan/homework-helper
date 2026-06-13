# Homework Helper — Design Spec (v2)

**Date:** 2026-06-13
**Status:** Awaiting user spec review
**Supersedes:** `2026-05-25-homework-helper-design.md` (v1 — assumed two Year-7 kids,
LAN-only, no auth). This v2 reflects three kids across a wide age range, public
access via Cloudflare Tunnel, photo+type input, a transcription-correction step,
and read-aloud.

## Purpose

A self-hosted Socratic homework tutor for three kids. A kid picks who they are,
captures a homework question (photo or typed), confirms what was read, and gets
per-question feedback: praise for correct work, and for the rest **3 progressive,
example-driven hints** that teach — **never the final answer**. Subjects: Maths and
English. Runs family-scale, reachable from the kids' phones anywhere.

## Users — three kids, one app, calibrated per child

| id      | Name   | Level   | Age | Tutor calibrates to                         |
|---------|--------|---------|-----|---------------------------------------------|
| jai     | Jai    | Year 9  | ~14 | Algebra, essay structure, analysis          |
| keeran  | Keeran | Grade 6 | 12  | Fractions, paragraphs, comprehension        |
| zane    | Zane   | Grade 2 | 8   | Basic arithmetic, sight words, sentences    |

Each profile is hardcoded in config: `{ id, name, level, age }`. **`level` and
`age` are passed into the tutor prompt** so difficulty, vocabulary, tone, and the
shape of worked examples match the child. They also drive UI scaling (larger text /
simpler chrome for younger kids). Profile selection is honour-system (no per-kid
auth); it identifies *who* is using the app, not a security boundary.

## Non-Goals (v1)

- Parent cross-kid dashboard
- Per-kid auth / PINs (profile picker is honour-system)
- **Voice input** (speak-the-question) — explicitly cut; may revisit
- Science / Languages prompts
- Storing homework images
- Multi-call agentic tutoring (one call per page)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry flow | Two-step: pick kid → capture | Clear, few choices per screen |
| Input | Photo (hero) + type | Voice input cut for v1 |
| Pre-tutoring | "Did we read it right?" correction (edit text or retake) | Bad OCR shouldn't poison tutoring |
| Hint reveal | Accumulate, one tap at a time; hint 3 second-confirm gated | Re-readable build-up; prevents skipping to the example |
| Pedagogy | Concrete, **example-driven** hints that withhold the answer; a final **gated "show me" reveals the full solution** to their actual question | Productive struggle first, but don't leave a genuinely stuck kid frustrated |
| Read-aloud | Yes — browser `SpeechSynthesis` on hints/feedback | Free; lets Zane (8) work solo; helps all |
| Access | Cloudflare Tunnel (public HTTPS) via existing `cloudflared` | Works anywhere; HTTPS needed for camera |
| Auth | None (secret URL) + **server-side daily request cap** | User's call; cap is the credit-abuse backstop |
| Model | `claude-sonnet-4-6` via Agent SDK | Good vision + pedagogy at sensible credit cost |
| Billing | Max subscription Agent SDK bucket (no `ANTHROPIC_API_KEY`) | Enforced by startup guard |
| Image storage | None — in-memory, discarded after analysis | Privacy |
| Structured output | Prompt-for-JSON + strict `zod` validation | Validation is source of truth |
| Calls per submission | One (whole page) | Full context, cheaper |
| Deploy | Docker Compose in a Debian LXC on Proxmox | Reproducible; needs LXC nesting |
| Methodology | TDD — each test tied to observable user value | Red → green → refactor; SDK mocked |

## Flow (mobile-first)

1. **Pick kid** — three large buttons (Jai / Keeran / Zane).
2. **Capture** — 📸 *Take a photo* (hero) or ⌨️ *Type it*.
3. **"Did we read it right?"** — show transcribed question + the kid's answer;
   **edit the text inline or retake/re-enter** before tutoring runs.
4. **Results** — one card per question with a status badge:
   ✅ correct · 🟡 partial · ⭕ unanswered · ❌ incorrect. Overall encouragement at top.
5. **Question detail** — tap a non-correct card → hints **accumulate** one tap at a
   time (earlier hints stay visible). Hint 3 (worked example) is gated behind a
   second explicit confirmation. After all 3 hints, a final **"Still stuck? Show me
   how to solve this one"** button — itself gated behind an explicit confirm —
   reveals the **full worked solution to their actual question, answer included**.
   🔊 read-aloud on each hint, the solution, and feedback.
6. **History** — per-kid list of past submissions, text only.

UI text size and word-simplicity scale automatically from the kid's `level` — no setting.

## Pedagogy (the core IP)

### System prompt hard constraints (`prompts.ts`)

1. **Golden rule (in hints):** the **hints** never state the answer to a question the
   kid got wrong or left blank — no final numeric/textual answer, no "the answer is…".
   Hints lead the kid to it; they don't hand it over.
2. **Escape hatch:** separately produce a `solution` — a full, step-by-step worked
   solution **of the kid's actual question, answer included**. The UI keeps it hidden
   behind all 3 hints + an explicit confirm, so it's a deliberate last resort, not the
   default. (Softens the old hard "never reveal" rule: don't leave a stuck kid lost.)
3. Classify each item: `correct | partial | incorrect | unanswered`.
4. For every non-correct item, produce **exactly 3 progressive hints**:
   - level 1 `nudge` — a gentle question that points attention.
   - level 2 `concept` — the rule/method, **carrying a short concrete example**.
   - level 3 `worked_example` — a *fully solved* example on **different, and where
     helpful simpler, numbers/wording** than the kid's actual question.
5. **Concrete over abstract** — every hint should show via example, not lecture.
   Calibrate to the kid's `level`/`age` (e.g. count-on for Zane; factoring for Jai).
6. Correct items: praise, **zero hints**, `solution` null.
7. Warm, encouraging, age-appropriate. Subjects: maths & English.
8. Output **only** the JSON object below — no prose around it.

### Result contract (`types.ts`)

```ts
type Status = "correct" | "partial" | "incorrect" | "unanswered";
type HintType = "nudge" | "concept" | "worked_example";

interface Hint {
  level: 1 | 2 | 3;
  type: HintType;        // 1→nudge, 2→concept, 3→worked_example
  text: string;
}

interface TutorItem {
  id: string;
  questionText: string;        // transcribed/typed question
  studentAnswer: string | null;
  status: Status;
  feedback: string;            // short, always present
  hints: Hint[];               // [] iff status === "correct", else exactly 3
  solution: string | null;     // full worked solution of THIS question, answer
                               // included; null iff correct. UI gates it behind
                               // all 3 hints + an explicit confirm (escape hatch).
}

interface TutorResult {
  subject: "maths" | "english" | "mixed";
  summary: string;             // overall encouragement
  items: TutorItem[];
}
```

### `claude.ts` validation (zod) — enforced invariants

- Top-level shape matches `TutorResult`; unknown keys rejected.
- `status === "correct"` ⇒ `hints.length === 0` **and** `solution === null`.
- `status !== "correct"` ⇒ `hints.length === 3`, levels exactly `[1,2,3]` in order,
  types exactly `[nudge, concept, worked_example]`, **and** `solution` is a non-empty
  string.
- **Answer-leak heuristic (hints only):** if `studentAnswer` (or the derived correct
  answer) is numeric, the **hint** text — especially level 3 — must not contain that
  exact value as a standalone token. **The `solution` field is exempt** — it's the
  escape hatch and is *meant* to contain the answer; the UI gating is its safeguard.
- On parse failure or invalid output: **one retry**, then a structured error the UI
  renders as a friendly "couldn't read that — try again".

### Input & image handling (`images.ts` + `claude.ts`)

- Photo path: `images.ts` resizes/normalises (cap longest edge, strip metadata, JPEG)
  → base64. `claude.ts` sends a single `query()` with the image content block,
  `maxTurns: 1`, no tools.
- Typed path: question text goes straight into the prompt, no image block.
- **Correction step:** the first call transcribes the page and returns the
  question(s)+answer(s) for confirmation; the kid may edit text or retake before the
  tutoring result is produced. (Implementation may do this as one call returning a
  confirmable transcription, then a second on confirm — verified during build.)
- Exact Agent SDK option names verified against the installed
  `node_modules/@anthropic-ai/claude-agent-sdk/dist/*.d.ts` at implementation time.

## Data + API

SQLite (`better-sqlite3`):

```sql
submissions(
  id          TEXT PRIMARY KEY,   -- nanoid
  profile_id  TEXT NOT NULL,      -- jai | keeran | zane
  created_at  TEXT NOT NULL,      -- ISO8601
  subject     TEXT NOT NULL,
  summary     TEXT NOT NULL,
  items_json  TEXT NOT NULL       -- serialized TutorItem[]
)
```

No image column. A lightweight **daily counter** (table or in-memory keyed by date)
enforces the request cap.

Endpoints (Fastify + `@fastify/multipart` + `@fastify/static`):

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/profiles` | List kids from config (id, name, level) |
| POST | `/api/submit` | multipart `image` **or** `text` + `profileId` → (resize) → Claude → persist → `TutorResult`. Enforces daily cap (429 + friendly message when exceeded). |
| GET  | `/api/history?profileId=` | Submissions for a kid, newest first |
| GET  | `/api/submission/:id` | Full stored `TutorResult` |
| (static) | `/*` | Serve `web/dist` SPA |

## Access & Safety

- **Cloudflare Tunnel** (existing `cloudflared` LXC) → public HTTPS URL, reachable on
  home WiFi and cellular. HTTPS satisfies the phone camera requirement.
- **No login** (secret URL), per user decision.
- **Server-side daily request cap** as the credit-abuse backstop: once N successful
  tutoring calls happen in a day, `/api/submit` returns a friendly "that's enough for
  today" until the next day. N configurable in `config.ts`.

## Claude Auth / Billing (load-bearing)

Calls Claude via `@anthropic-ai/claude-agent-sdk`, inheriting OAuth from the `claude`
CLI in the container. Usage routes onto the Max subscription's Agent SDK credit bucket
**because `ANTHROPIC_API_KEY` is absent**.

- `docker-compose.yml` never forwards `ANTHROPIC_API_KEY`.
- **Startup guard:** if the app sees `ANTHROPIC_API_KEY`, it logs a prominent warning
  and refuses to start (so we never silently fall to pay-as-you-go API billing).
- `make login` runs `claude login` once; the `claude-auth` named volume persists
  `~/.claude` across rebuilds.

## Architecture

```
kids/
├─ api/                 Fastify backend (TypeScript, Node 20)
│  └─ src/
│     ├─ index.ts       bootstrap, routes, static serving, ANTHROPIC_API_KEY guard
│     ├─ config.ts      profiles (3 kids w/ level+age), paths, model id, daily cap
│     ├─ prompts.ts     ★ pedagogy: system prompt + per-kid request builder
│     ├─ claude.ts      ★ Agent SDK call + JSON parse/validate (zod) + retry
│     ├─ db.ts          better-sqlite3 schema + queries + daily counter
│     ├─ images.ts      sharp resize/normalise → base64
│     └─ types.ts       shared result types (imported by web too)
├─ web/                 React 18 + Vite + TypeScript (mobile-first)
│  └─ src/
│     ├─ main.tsx, App.tsx
│     ├─ styles.css     design tokens
│     ├─ api.ts         fetch wrappers
│     ├─ speech.ts      read-aloud (SpeechSynthesis) wrapper
│     └─ components/    KidPicker, Capture, Confirm, Results, ProblemDetail, History
├─ Dockerfile           multi-stage: web build → api build → runtime + claude CLI
├─ docker-compose.yml   volumes: claude-auth → ~/.claude; ./data bind for sqlite
├─ Makefile             build / login / up / down / logs / update
└─ data/                sqlite db (bind-mounted, gitignored)
```

Each unit has one purpose and a clear interface: `images.ts` (bytes → base64),
`prompts.ts` (kid + input → messages), `claude.ts` (input → validated result),
`db.ts` (result ↔ persistence + cap), routes (HTTP glue), `speech.ts` (text → audio).
The validated `TutorResult` is the contract between backend and frontend.

## Frontend design

"Warm study notebook": cream `#F7F2E7`, forest green `#2F5D50`, amber accent
`#E8A33D`, Fraunces headings, Plus Jakarta Sans body, vanilla CSS, inline SVG icons.
Status badge colors: green correct, amber partial, terracotta incorrect/blank.

## Deployment

- **Dockerfile** multi-stage: (1) Vite build `web`; (2) `tsc` build `api`;
  (3) runtime `node:20-slim` with `@anthropic-ai/claude-code` global, built api +
  `web/dist`, runs as `node` (UID 1000), exposes `:8080`.
- **docker-compose.yml**: single service; `claude-auth` volume → `/home/node/.claude`;
  `./data` bind-mounted; **does not** pass `ANTHROPIC_API_KEY`.
- **Proxmox LXC**: Debian, Docker, nesting (`features: nesting=1`, keyctl). README
  documents the `./data` chown gotcha (privileged `1000:1000`; unprivileged
  `101000:101000`).
- **Cloudflare Tunnel**: route the public hostname → container `:8080`.
- **Makefile**: `build`, `login`, `up`, `down`, `logs`, `update`.

## Testing (TDD — value-first; SDK mocked, no real credits)

Backend:
- Correct answer → praise, **zero** hints, **`solution` null**. *(validator)*
- Wrong answer → **exactly three** hints, nudge→concept→worked-example, **plus a
  non-empty `solution`**. *(validator)*
- Hint text does not reuse the kid's numeric answer; the **`solution` field is allowed
  to**. *(answer-leak guard scoped to hints)*
- Malformed model output → one retry → friendly structured error, never a crash.
- `prompts.ts` injects the kid's `level`/`age` and the golden-rule system prompt.
- Typed-text submission works without an image block.
- Daily cap: the (N+1)th submission in a day returns the friendly 429.
- Submitting records exactly one history entry; `GET /api/submission/:id` returns it.
- Startup guard refuses to boot when `ANTHROPIC_API_KEY` is set.

Frontend (light — Vitest + Testing Library):
- ProblemDetail reveals hints one tap at a time; hint 3 hidden until second confirm.
- The "Show me how to solve this one" solution stays hidden until all 3 hints are
  revealed AND an explicit confirm; only then does it show the answer.
- A correct item shows no "reveal hint" affordance and no solution button.
- Confirm screen lets the user edit the transcription before submitting.
- Read-aloud button invokes the speech wrapper.

E2E out of scope for v1 (YAGNI).

## Open Risks / To Verify During Implementation

1. Exact Agent SDK option names & result-message shape vs. installed `.d.ts`.
2. Whether the transcription-correction is best as one call (transcribe→confirm→tutor
   in stages) or two calls; decide during build to balance credits vs. UX.
3. Native `outputFormat` JSON-schema enforcement in the installed SDK (use if present;
   else prompt+zod).
4. Docker-in-LXC nesting/keyctl on the Proxmox host (host access now confirmed).
5. Cloudflare Tunnel config + public hostname routing to the container.
6. `SpeechSynthesis` voice quality/availability on the kids' specific phones.
