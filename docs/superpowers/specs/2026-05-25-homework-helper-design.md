# Homework Helper — Design Spec

**Date:** 2026-05-25
**Status:** Awaiting user spec review

## Purpose

A self-hosted Socratic homework tutor for two Year 7+ kids. A kid snaps a
photo of their homework on a phone; the app returns per-question feedback
with progressively-revealed hints, and **never gives the final answer** —
only nudges, concept pointers, and worked examples on *different* numbers.
Focus subjects: Maths and English. Runs family-scale on a home network.

## Non-Goals (v1)

Explicitly deferred — not in this build:

- Parent read-only cross-kid view
- Per-kid 4-digit PIN / any real auth (frontend is honour-system)
- Science / Languages prompts
- Explicit prompt-cache tuning
- Storing homework images

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Core loop only | Photo → classify → progressive hints → history |
| Profiles | Hardcoded in config | Two kids, honour-system; no add/edit UI |
| Model | Latest Sonnet (`claude-sonnet-4-6`) | Sufficient for Y7, cheaper on credit bucket, caching-friendly |
| Image → Claude | Inline base64 content block, single-shot | No extra agent turn vs. Read-tool; no disk writes |
| Image storage | None — in-memory only, discarded after analysis | Privacy; keeps focus on learning artifacts |
| Structured output | Prompt-for-JSON + strict `zod` validation (source of truth) | Brief requires `claude.ts` to parse+validate; native `outputFormat` used only if confirmed in installed `.d.ts` |
| Calls per photo | One call for the whole page | Full-page context, cheaper credits |
| Deploy | Docker Compose inside a Debian LXC on Proxmox | Reproducible; matches brief; needs LXC nesting enabled |
| Billing | Subscription (Agent SDK credit bucket) | Routed by absence of `ANTHROPIC_API_KEY`; enforced by startup guard |
| Methodology | TDD — each test tied to observable end-user value | Red → green → refactor; SDK mocked in tests |

## Claude Auth / Billing Model (load-bearing)

The app calls Claude via `@anthropic-ai/claude-agent-sdk`, which inherits
OAuth credentials from the `claude` CLI installed in the container. Usage
routes onto the Max subscription's Agent SDK credit bucket **because
`ANTHROPIC_API_KEY` is absent**. Enforcement:

- `docker-compose.yml` never forwards `ANTHROPIC_API_KEY`.
- **Startup guard:** if the app process sees `ANTHROPIC_API_KEY` in its
  environment, it logs a prominent warning and refuses to start (fail-safe,
  so we never silently fall to pay-as-you-go API billing).
- `make login` runs `claude login` once interactively; the `claude-auth`
  named volume persists `~/.claude` across rebuilds.

## Architecture

```
kids/
├─ api/                 Fastify backend (TypeScript, Node 20)
│  └─ src/
│     ├─ index.ts       server bootstrap, route registration, static serving,
│     │                 ANTHROPIC_API_KEY startup guard
│     ├─ config.ts      hardcoded profiles, paths, model id, limits
│     ├─ prompts.ts     ★ pedagogy: system prompt + per-request builder
│     ├─ claude.ts      ★ Agent SDK call + JSON parse/validate (zod)
│     ├─ db.ts          better-sqlite3 schema + queries
│     ├─ images.ts      sharp resize/normalise → base64
│     └─ types.ts       shared result types (imported by web too)
├─ web/                 React 18 + Vite + TypeScript
│  └─ src/
│     ├─ main.tsx, App.tsx
│     ├─ styles.css     design tokens
│     ├─ api.ts         fetch wrappers
│     └─ components/    ProfilePicker, Capture, Results, ProblemDetail, History
├─ Dockerfile           multi-stage: web build → api build → runtime + claude CLI
├─ docker-compose.yml   volumes: claude-auth → ~/.claude; ./data bind for sqlite
├─ Makefile             build / login / up / down / logs / update
├─ Caddyfile.example    HTTPS reverse-proxy snippet
└─ data/                sqlite db (bind-mounted, gitignored)
```

Each unit has one purpose and a clear interface: `images.ts` (bytes → resized
base64), `prompts.ts` (request → messages), `claude.ts` (image → validated
result), `db.ts` (result ↔ persistence), routes (HTTP glue). The validated
`TutorResult` type is the contract between backend and frontend.

## The Core IP — Pedagogy

### System prompt (`prompts.ts`) — hard constraints

1. **Golden rule:** never state the answer to a question the kid got wrong or
   left blank. No final numeric/textual answer, no "the answer is…".
2. Classify each item: `correct | partial | incorrect | unanswered`.
3. For every non-correct item, produce **exactly 3 progressive hints**:
   - level 1 `nudge` — a gentle question that points attention.
   - level 2 `concept` — the rule / concept / method to apply.
   - level 3 `worked_example` — a *fully solved* example on **different
     numbers / different wording** from the kid's actual question.
4. For correct items: praise, **zero hints**.
5. Warm, encouraging, age-appropriate (Year 7). Subjects: maths & English.
6. Output **only** the JSON object described below — no prose around it.

### Result contract (`types.ts`)

```ts
type Status = "correct" | "partial" | "incorrect" | "unanswered";
type HintType = "nudge" | "concept" | "worked_example";

interface Hint {
  level: 1 | 2 | 3;
  type: HintType;       // level 1→nudge, 2→concept, 3→worked_example
  text: string;
}

interface TutorItem {
  id: string;
  questionText: string;       // transcribed from the photo
  studentAnswer: string | null;
  status: Status;
  feedback: string;           // short, always present
  hints: Hint[];              // [] iff status === "correct", else exactly 3
}

interface TutorResult {
  subject: "maths" | "english" | "mixed";
  summary: string;            // overall encouragement
  items: TutorItem[];
}
```

### `claude.ts` validation (zod) — enforced invariants

- Top-level shape matches `TutorResult`; unknown keys rejected.
- `status === "correct"` ⇒ `hints.length === 0`.
- `status !== "correct"` ⇒ `hints.length === 3`, levels exactly `[1,2,3]`
  in order, types exactly `[nudge, concept, worked_example]`.
- **Answer-leak heuristic** for the worked example: if `studentAnswer` is
  numeric, the level-3 text must not contain that exact value as a standalone
  token; flag/reject if it does. (Best-effort guard; the prompt is the
  primary defense.)
- On parse failure or invalid output: **one retry**, then return a structured
  error the UI renders as a friendly "couldn't read that — try again".

### Image handling (`claude.ts` + `images.ts`)

`images.ts` resizes/normalises the uploaded photo (cap longest edge, strip
metadata, JPEG) and returns base64. `claude.ts` sends a single `query()` with
the image as a base64 content block, `maxTurns: 1`, no tools. It reads the
final result message, extracts the assistant text, parses + validates.
Exact SDK option names (`systemPrompt`, `allowedTools`, `permissionMode`,
`maxTurns`, `model`, possibly `outputFormat`) are **verified against the
installed `node_modules/@anthropic-ai/claude-agent-sdk/dist/*.d.ts` at
implementation time** and adjusted if the SDK differs.

## Data + API

SQLite (`better-sqlite3`), one table:

```sql
submissions(
  id            TEXT PRIMARY KEY,   -- nanoid
  profile_id    TEXT NOT NULL,
  created_at    TEXT NOT NULL,      -- ISO8601
  subject       TEXT NOT NULL,
  summary       TEXT NOT NULL,
  items_json    TEXT NOT NULL       -- serialized TutorItem[]
)
```

No image column (images are not stored).

Endpoints (Fastify + `@fastify/multipart` + `@fastify/static`):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/profiles` | List kids from config |
| POST | `/api/submit` | multipart `image` + `profileId` → resize → Claude → persist → return `TutorResult` |
| GET | `/api/history?profileId=` | List submissions for a kid, newest first (id, created_at, subject, summary, item count) |
| GET | `/api/submission/:id` | Full stored `TutorResult` |
| (static) | `/*` | Serve `web/dist` SPA |

## Frontend Flow (mobile-first)

1. **ProfilePicker** — choose which kid (from `/api/profiles`).
2. **Capture** — `<input type="file" accept="image/*" capture="environment">`,
   show preview, submit, loading state.
3. **Results** — one card per item with a status badge; tap a card →
4. **ProblemDetail** — hints revealed one tap at a time; **hint 3
   (worked example) gated behind a second explicit confirmation** so kids
   don't blow straight through.
5. **History** — per-profile list of past submissions, text-only.

Design: "warm study notebook" — cream `#F7F2E7`, forest green `#2F5D50`,
Fraunces headings, Plus Jakarta Sans body, vanilla CSS, inline SVG icons.

## Deployment

- **Dockerfile** multi-stage: (1) build `web` with Vite; (2) build `api` with
  `tsc`; (3) runtime on `node:20-slim` with `@anthropic-ai/claude-code`
  installed globally, built api + `web/dist` copied in, runs as `node`
  (UID 1000), exposes `:8080`.
- **docker-compose.yml**: the single service; `claude-auth` named volume →
  `/home/node/.claude`; `./data` bind-mounted for the SQLite file; **does not**
  pass `ANTHROPIC_API_KEY`.
- **Proxmox LXC**: Debian, Docker installed; LXC must allow nesting
  (`features: nesting=1`, keyctl). README documents the host `./data` chown
  gotcha: privileged LXC `chown 1000:1000 ./data`; unprivileged (userns
  remap) `chown 101000:101000 ./data`.
- **Caddy** (external, existing): `Caddyfile.example` reverse-proxies HTTPS →
  `:8080`. HTTPS is required for phone camera access.
- **Makefile**: `build`, `login` (interactive `claude login`), `up`, `down`,
  `logs`, `update` (pull + rebuild + restart).

## Testing (TDD — value-first)

SDK is mocked in all tests; no real Claude calls / credits.

Backend (Vitest or node:test):

- A correct answer produces praise and **zero** hints. *(validator)*
- A wrong answer produces **exactly three** hints in nudge→concept→
  worked-example order. *(validator)*
- The worked example does not reuse the kid's own numeric answer.
  *(answer-leak heuristic)*
- Malformed model output triggers one retry, then a friendly structured
  error — never a crash. *(claude.ts)*
- `prompts.ts` builds a message containing the image block and the golden-rule
  system prompt.
- Submitting a photo records exactly one entry in that kid's history;
  `GET /api/submission/:id` returns it intact. *(db + routes, SDK mocked)*
- The startup guard refuses to boot when `ANTHROPIC_API_KEY` is set.

Frontend (light — Vitest + Testing Library):

- ProblemDetail reveals hints one tap at a time.
- Hint 3 stays hidden until the second confirmation.
- A correct item shows no "reveal hint" affordance.

E2E is out of scope for v1 (YAGNI).

## Open Risks / To Verify During Implementation

1. Exact Agent SDK option names & result-message shape vs. installed `.d.ts`.
2. Whether native `outputFormat` JSON-schema enforcement exists in the
   installed SDK version (use if present; otherwise prompt+zod only).
3. Docker-in-LXC nesting/keyctl requirements on the user's Proxmox host
   (documented; user verifies on real host — no access yet).
