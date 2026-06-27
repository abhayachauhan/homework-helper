# Homework Helper

A self-hosted, mobile-first **Socratic homework tutor** for kids. A kid snaps a photo
(or types) a homework question; the app marks each question and, for the ones that
aren't right, gives **progressive, example-driven hints that lead them to the answer** —
with the full worked solution gated behind the hints so they have to think first.
Read-aloud is built in for younger kids.

## How it works

Pick kid → capture (📸 photo or ⌨️ type) → results with a **score** → tap a question →
reveal hints **one at a time** (the worked example and the full solution are gated) →
🔊 read-aloud → history. While a submission is processing, a progress bar + a rotating
kid-friendly joke/fact keeps them entertained.

**Pedagogy (the core idea):**
- Hints **never state the final answer** to the kid's actual question.
- The 3 hints form **one connected step-by-step chain** (and flag multi-step problems,
  naming the first step) — not three loosely-related tips.
- A gated **"show me how to solve this one"** reveals the full worked solution (answer
  included) only after all 3 hints + an explicit confirm.
- Language is calibrated to each kid's grade/age (short sentences, no jargon for the young).

## Architecture

- **`api/`** — Fastify (TypeScript, Node 20). HTTP routes, image normalise (`sharp`),
  the Claude call via `@anthropic-ai/claude-agent-sdk`, strict `zod` validation of the
  tutoring JSON, `better-sqlite3` persistence, a daily request cap, and an optional PIN gate.
- **`web/`** — React 18 + Vite + TypeScript SPA (served by the API in production).
- **Model:** `claude-sonnet-4-6` (single source of truth: `api/src/config.ts`).
- **Billing / auth:** the Agent SDK authenticates through the `claude` CLI's OAuth login,
  so usage bills your **Claude subscription**. `ANTHROPIC_API_KEY` is intentionally **not**
  used — a startup guard refuses to boot if it's set (prevents accidental pay-as-you-go).

## Repo layout

```
api/            Fastify backend (TS)  — src/{index,config,prompts,claude,tutorResult,db,images,startup,types}.ts
web/            React + Vite SPA      — src/{App,api,speech,types}.ts(x), src/components/*
Dockerfile      multi-stage: web build → api build → runtime (+ claude CLI)
docker-compose.yml   single service; claude-auth + ./data volumes; no ANTHROPIC_API_KEY
Makefile        build / login / up / down / logs / update / smoke
docs/superpowers/specs/   design spec (latest: 2026-06-13-homework-helper-design.md)
docs/superpowers/plans/   implementation plans (backend / frontend / deploy)
```

## Local development

```bash
# Backend (needs `claude login` once for live model calls)
cd api && npm install && npm run dev      # :8080

# Frontend (in another terminal)
cd web && npm install && npm run dev      # :5173, proxies /api → :8080
# open http://localhost:5173
```

## Testing (TDD, SDK mocked — no real credits used)

```bash
cd api && npm test     # vitest
cd web && npm test     # vitest + @testing-library/react
```

## Configuration (environment variables)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8080` | HTTP port |
| `HH_DB_PATH` | `./data/homework.db` | SQLite file (the parent dir is auto-created) |
| `HH_DAILY_CAP` | `50` | Max successful submissions per day (credit-abuse backstop) |
| `HH_PIN` | _(empty)_ | If set, a family PIN is required (enforced server-side); gate is off when empty |
| `ANTHROPIC_API_KEY` | _(must be unset)_ | Startup guard **refuses to boot** if present |

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/profiles` | The kid profiles |
| GET | `/api/config` | `{ pinRequired }` |
| POST | `/api/pin` | `{ pin }` → `{ ok }` or 401 |
| POST | `/api/submit` | JSON `{ profileId, text }` **or** multipart image at `/api/submit?profileId=<id>` (field `image`). Send header `x-hh-pin` when a PIN is set. |
| GET | `/api/history?profileId=<id>` | Past submissions, newest first |
| GET | `/api/submission/:id` | Full stored result |

## Deployment

**Docker (any host):**
```bash
docker compose build
make login          # one-time interactive `claude login` (writes to the claude-auth volume)
docker compose up -d
```
The compose service mounts a `claude-auth` volume (persists the login) and `./data`
(SQLite), and never forwards `ANTHROPIC_API_KEY`.

**Notes that matter:**
- Run the app as a **non-root** user. The `claude` CLI refuses `--dangerously-skip-permissions`
  (used by the SDK) when running as root, which crashes the tutoring call.
- For phone **camera** capture you must serve over **HTTPS** (e.g. behind a Cloudflare Tunnel
  or a reverse proxy with TLS).
- Set `HH_PIN` in the runtime environment (not committed) to enable the family PIN.

> Operational specifics for this household's deployment (container, tunnel, PIN value,
> update commands) live outside this public repo.
