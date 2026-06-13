# Homework Helper — Frontend Implementation Plan (2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile-first React SPA: pick kid → capture (photo/type) → results with per-question status → accumulating, answer-free hints with a gated "show me" solution → read-aloud → history. Built against the real backend (Plan 1, already merged).

**Architecture:** A small screen state-machine in `App.tsx` (no router dep) drives stateless presentational components. A typed `api.ts` wraps the backend; `speech.ts` wraps the browser `SpeechSynthesis` for read-aloud. The validated `TutorResult` shape (mirrored in `web/src/types.ts`) is the backend↔frontend contract.

**Tech Stack:** Vite, React 18, TypeScript, vanilla CSS; Vitest + @testing-library/react + @testing-library/user-event + jsdom for tests.

**Spec:** `docs/superpowers/specs/2026-06-13-homework-helper-design.md`

## Backend contract (already built — do not change)
- `GET /api/profiles` → `Profile[]` (`{id,name,level,age}`), order `jai, keeran, zane`.
- `POST /api/submit` — JSON `{profileId, text}` → `{id, result}`; OR multipart image: `POST /api/submit?profileId=<id>` with `FormData` field `image` → `{id, result}`. **profileId goes in the query string for image uploads.** 400 unknown profile / missing text / missing image; 429 daily cap (`{message}`); 502 friendly tutor failure.
- `GET /api/history?profileId=<id>` → `SubmissionSummary[]` newest-first (`{id,profileId,createdAt,subject,summary,itemCount}`).
- `GET /api/submission/:id` → `{id, profileId, createdAt, result}` or 404.

## Design decision (deviation from spec, confirmed)
The spec's pre-tutoring "did we read it right?" correction is folded into the **results screen**: each item shows the transcribed `questionText` + `studentAnswer`, and a "Something look wrong? Retake / re-type" control returns to capture and resubmits. No separate transcribe call (backend is one-shot; spec Risk #2 left this open). Typed input is editable in a textarea before submit, so its only "misread" risk is zero.

---

## File Structure

```
web/
├─ package.json          Vite + React + TS + vitest + testing-library
├─ vite.config.ts        React plugin; dev proxy /api → http://localhost:8080; vitest jsdom config
├─ tsconfig.json         bundler resolution, strict, jsx react-jsx
├─ index.html            root div + module script
└─ src/
   ├─ main.tsx           ReactDOM root → <App/>
   ├─ App.tsx            screen state-machine + data loading
   ├─ types.ts           Status, Hint, TutorItem, TutorResult, Profile, SubmissionSummary, SubmitResponse
   ├─ api.ts             ApiError + getProfiles/submitText/submitImage/getHistory/getSubmission
   ├─ speech.ts          speak(), stopSpeaking(), speechSupported()
   ├─ styles.css         design tokens + component classes (warm notebook)
   └─ components/
      ├─ KidPicker.tsx       three kid buttons
      ├─ Capture.tsx         photo (hero) + type toggle
      ├─ StatusBadge.tsx     status → emoji/label/class
      ├─ Results.tsx         summary + item cards + retake
      ├─ ProblemDetail.tsx   ★ accumulating hints + gated worked-example + gated solution + read-aloud
      ├─ History.tsx         per-kid past submissions
      └─ ReadAloudButton.tsx 🔊 button calling speak()
```

`App.tsx` owns all state; components are presentational and receive props + callbacks. This keeps each component independently testable.

---

## Task 0: Scaffold the `web/` project

**Files:** Create `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx` (placeholder), `web/src/styles.css` (empty), `web/src/vite-env.d.ts`.

- [ ] **Step 1: `web/package.json`**

```json
{
  "name": "homework-helper-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `web/vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8080" } },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: `web/src/test-setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <title>Homework Helper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: `web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: `web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 8: placeholder `web/src/App.tsx` and empty `web/src/styles.css`**

```tsx
export default function App() {
  return <div>Homework Helper</div>;
}
```
(styles.css: empty for now.)

- [ ] **Step 9: install + verify**

Run: `cd web && npm install` (use `dangerouslyDisableSandbox: true` if the sandbox blocks network).
Then: `cd web && npx vitest run` → expect exit 0 with "No test files found".
Then: `cd web && npx tsc -b` → clean.

- [ ] **Step 10: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/package.json web/tsconfig.json web/vite.config.ts web/index.html web/src/main.tsx web/src/App.tsx web/src/styles.css web/src/test-setup.ts web/src/vite-env.d.ts web/package-lock.json && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "chore(web): scaffold vite react app (ts, vitest, testing-library)"
```
(Do not commit `web/node_modules` — root .gitignore covers it.)

---

## Task 1: Types + API client

**Files:** Create `web/src/types.ts`, `web/src/api.ts`; Test `web/src/api.test.ts`.

- [ ] **Step 1: `web/src/types.ts`**

```ts
export type Status = "correct" | "partial" | "incorrect" | "unanswered";
export type HintType = "nudge" | "concept" | "worked_example";
export type Subject = "maths" | "english" | "mixed";

export interface Hint { level: 1 | 2 | 3; type: HintType; text: string; }

export interface TutorItem {
  id: string;
  questionText: string;
  studentAnswer: string | null;
  status: Status;
  feedback: string;
  hints: Hint[];
  solution: string | null;
}

export interface TutorResult { subject: Subject; summary: string; items: TutorItem[]; }
export interface Profile { id: string; name: string; level: string; age: number; }
export interface SubmissionSummary {
  id: string; profileId: string; createdAt: string;
  subject: string; summary: string; itemCount: number;
}
export interface SubmitResponse { id: string; result: TutorResult; }
```

- [ ] **Step 2: failing test `web/src/api.test.ts`**

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { getProfiles, submitText, submitImage, getHistory, ApiError } from "./api.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("getProfiles returns the parsed list", async () => {
    vi.stubGlobal("fetch", mockFetch(200, [{ id: "jai", name: "Jai", level: "Year 9", age: 14 }]));
    const profiles = await getProfiles();
    expect(profiles[0].id).toBe("jai");
  });

  it("submitText posts JSON to /api/submit", async () => {
    const f = mockFetch(200, { id: "s1", result: { subject: "maths", summary: "ok", items: [] } });
    vi.stubGlobal("fetch", f);
    const res = await submitText("jai", "2+2");
    expect(res.id).toBe("s1");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/submit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ profileId: "jai", text: "2+2" });
  });

  it("submitImage posts multipart with profileId in the query string", async () => {
    const f = mockFetch(200, { id: "s2", result: { subject: "maths", summary: "ok", items: [] } });
    vi.stubGlobal("fetch", f);
    const file = new File(["x"], "hw.jpg", { type: "image/jpeg" });
    await submitImage("zane", file);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/submit?profileId=zane");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(file);
  });

  it("getHistory encodes the profileId", async () => {
    const f = mockFetch(200, []);
    vi.stubGlobal("fetch", f);
    await getHistory("keeran");
    expect(f.mock.calls[0][0]).toBe("/api/history?profileId=keeran");
  });

  it("throws ApiError with the server message on non-2xx", async () => {
    vi.stubGlobal("fetch", mockFetch(429, { message: "enough for today" }));
    await expect(submitText("jai", "x")).rejects.toMatchObject({ status: 429, message: "enough for today" });
    await expect(submitText("jai", "x")).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 3: run it** → FAIL (cannot find ./api.js).

- [ ] **Step 4: `web/src/api.ts`**

```ts
import type { Profile, SubmissionSummary, SubmitResponse, TutorResult } from "./types.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function getProfiles(): Promise<Profile[]> {
  return fetch("/api/profiles").then((r) => unwrap<Profile[]>(r));
}

export function submitText(profileId: string, text: string): Promise<SubmitResponse> {
  return fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId, text }),
  }).then((r) => unwrap<SubmitResponse>(r));
}

export function submitImage(profileId: string, file: File): Promise<SubmitResponse> {
  const body = new FormData();
  body.append("image", file);
  return fetch(`/api/submit?profileId=${encodeURIComponent(profileId)}`, {
    method: "POST",
    body,
  }).then((r) => unwrap<SubmitResponse>(r));
}

export function getHistory(profileId: string): Promise<SubmissionSummary[]> {
  return fetch(`/api/history?profileId=${encodeURIComponent(profileId)}`).then((r) =>
    unwrap<SubmissionSummary[]>(r)
  );
}

export function getSubmission(id: string): Promise<{ id: string; profileId: string; createdAt: string; result: TutorResult }> {
  return fetch(`/api/submission/${encodeURIComponent(id)}`).then((r) => unwrap(r));
}
```

- [ ] **Step 5: run it** → PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/types.ts web/src/api.ts web/src/api.test.ts && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): typed api client + shared result types"
```

---

## Task 2: Read-aloud (`speech.ts`)

**Files:** Create `web/src/speech.ts`; Test `web/src/speech.test.ts`.

- [ ] **Step 1: failing test `web/src/speech.test.ts`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { speak, stopSpeaking, speechSupported } from "./speech.js";

describe("speech", () => {
  beforeEach(() => {
    vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  });

  it("reports supported when speechSynthesis exists", () => {
    expect(speechSupported()).toBe(true);
  });

  it("cancels any current speech then speaks the text", () => {
    speak("hello there");
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce();
    const utt = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(utt.text).toBe("hello there");
  });

  it("stopSpeaking cancels", () => {
    stopSpeaking();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it("does not throw when speechSynthesis is unavailable", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(() => speak("x")).not.toThrow();
    expect(speechSupported()).toBe(false);
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/speech.ts`**

```ts
export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis;
}

export function speak(text: string): void {
  if (!speechSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
}
```

- [ ] **Step 4: run it** → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/speech.ts web/src/speech.test.ts && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): read-aloud wrapper over SpeechSynthesis"
```

---

## Task 3: Styles (design tokens)

**Files:** Replace `web/src/styles.css`. No test (pure CSS).

- [ ] **Step 1: write `web/src/styles.css`**

```css
:root {
  --cream: #f7f2e7;
  --ink: #33402f;
  --green: #2f5d50;
  --amber: #e8a33d;
  --green-soft: #eaf3ee;
  --good: #3fa66a;
  --warn: #e8a33d;
  --bad: #d7603f;
  --card: #ffffff;
  --muted: #8a8270;
  --radius: 18px;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { font-family: Fraunces, Georgia, serif; color: var(--green); margin: 0 0 8px; }
.app { max-width: 520px; margin: 0 auto; padding: 20px 16px 48px; min-height: 100vh; }
.screen { display: flex; flex-direction: column; gap: 14px; }
.subtitle { color: var(--muted); font-size: 14px; margin: 0; }
button { font-family: inherit; cursor: pointer; border: none; }
.btn-primary {
  background: var(--green); color: #fff; border-radius: var(--radius);
  padding: 16px; font-size: 17px; font-weight: 700; width: 100%;
}
.btn-secondary {
  background: var(--card); color: var(--ink); border: 1.5px solid #d8cfb8;
  border-radius: 14px; padding: 14px; font-size: 15px; font-weight: 600; width: 100%;
}
.btn-ghost { background: none; color: var(--green); font-weight: 600; padding: 8px; font-size: 14px; }
.kid-btn {
  background: var(--green); color: #fff; border-radius: var(--radius);
  padding: 22px; font-size: 20px; font-weight: 700; width: 100%; text-align: left;
}
.kid-btn .lvl { display: block; font-size: 13px; opacity: 0.8; font-weight: 500; margin-top: 4px; }
.hero { background: var(--green); color: #fff; border-radius: 22px; padding: 30px 16px; text-align: center; }
.hero .emoji { font-size: 44px; }
.row { display: flex; gap: 10px; }
.row > * { flex: 1; }
.card {
  background: var(--card); border-radius: 16px; padding: 14px; box-shadow: var(--shadow);
  display: flex; align-items: center; gap: 12px; text-align: left; width: 100%;
}
.card.correct { border-left: 5px solid var(--good); }
.card.partial { border-left: 5px solid var(--warn); }
.card.incorrect, .card.unanswered { border-left: 5px solid var(--bad); }
.card .meta { font-size: 11px; color: var(--muted); }
.badge { font-size: 22px; }
.hint { background: var(--green-soft); border-radius: 14px; padding: 14px; }
.hint .label { font-size: 10px; letter-spacing: 0.06em; font-weight: 800; color: var(--green); }
.hint .label.l1 { color: var(--good); }
.solution { background: #fff; border: 1.5px dashed var(--amber); border-radius: 14px; padding: 14px; }
.read { background: var(--green); color: #fff; border-radius: 10px; padding: 8px 12px; font-size: 13px; font-weight: 600; margin-top: 8px; }
.textarea { width: 100%; min-height: 120px; border-radius: 14px; border: 1.5px solid #d8cfb8; padding: 12px; font-family: inherit; font-size: 16px; }
.error { background: #fdecea; color: var(--bad); border-radius: 14px; padding: 14px; }
.spinner { text-align: center; padding: 40px; color: var(--muted); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
```

- [ ] **Step 2: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/styles.css && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): warm notebook design tokens + base styles"
```

---

## Task 4: StatusBadge + ReadAloudButton

**Files:** Create `web/src/components/StatusBadge.tsx`, `web/src/components/ReadAloudButton.tsx`; Test `web/src/components/StatusBadge.test.tsx`.

- [ ] **Step 1: failing test `web/src/components/StatusBadge.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge.js";

describe("StatusBadge", () => {
  it("shows a tick for correct and a label for unanswered", () => {
    const { rerender } = render(<StatusBadge status="correct" />);
    expect(screen.getByLabelText(/correct/i)).toBeInTheDocument();
    rerender(<StatusBadge status="unanswered" />);
    expect(screen.getByLabelText(/unanswered/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/components/StatusBadge.tsx`**

```tsx
import type { Status } from "../types.js";

const MAP: Record<Status, { emoji: string; label: string }> = {
  correct: { emoji: "✅", label: "Correct" },
  partial: { emoji: "🟡", label: "Partly there" },
  incorrect: { emoji: "❌", label: "Not quite" },
  unanswered: { emoji: "⭕", label: "Unanswered" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { emoji, label } = MAP[status];
  return (
    <span className="badge" role="img" aria-label={label}>
      {emoji}
    </span>
  );
}
```

- [ ] **Step 4: `web/src/components/ReadAloudButton.tsx`**

```tsx
import { speak, speechSupported } from "../speech.js";

export function ReadAloudButton({ text }: { text: string }) {
  if (!speechSupported()) return null;
  return (
    <button className="read" type="button" onClick={() => speak(text)}>
      🔊 Read it to me
    </button>
  );
}
```

- [ ] **Step 5: run it** → PASS (1 test).

- [ ] **Step 6: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/components/StatusBadge.tsx web/src/components/ReadAloudButton.tsx web/src/components/StatusBadge.test.tsx && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): status badge + read-aloud button"
```

---

## Task 5: KidPicker

**Files:** Create `web/src/components/KidPicker.tsx`; Test `web/src/components/KidPicker.test.tsx`.

- [ ] **Step 1: failing test `web/src/components/KidPicker.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KidPicker } from "./KidPicker.js";
import type { Profile } from "../types.js";

const profiles: Profile[] = [
  { id: "jai", name: "Jai", level: "Year 9", age: 14 },
  { id: "keeran", name: "Keeran", level: "Grade 6", age: 12 },
  { id: "zane", name: "Zane", level: "Grade 2", age: 8 },
];

describe("KidPicker", () => {
  it("renders a button per kid and calls onPick with the chosen profile", async () => {
    const onPick = vi.fn();
    render(<KidPicker profiles={profiles} onPick={onPick} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /keeran/i }));
    expect(onPick).toHaveBeenCalledWith(profiles[1]);
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/components/KidPicker.tsx`**

```tsx
import type { Profile } from "../types.js";

export function KidPicker({ profiles, onPick }: { profiles: Profile[]; onPick: (p: Profile) => void }) {
  return (
    <div className="screen">
      <h1>Who's doing homework?</h1>
      <p className="subtitle">Tap your name to start.</p>
      {profiles.map((p) => (
        <button key={p.id} className="kid-btn" type="button" onClick={() => onPick(p)}>
          {p.name}
          <span className="lvl">{p.level}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: run it** → PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/components/KidPicker.tsx web/src/components/KidPicker.test.tsx && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): kid picker screen"
```

---

## Task 6: Capture (photo + type)

**Files:** Create `web/src/components/Capture.tsx`; Test `web/src/components/Capture.test.tsx`.

`onSubmit` receives a discriminated payload. `busy` disables inputs while a submit is in flight.

- [ ] **Step 1: failing test `web/src/components/Capture.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Capture } from "./Capture.js";
import type { Profile } from "../types.js";

const jai: Profile = { id: "jai", name: "Jai", level: "Year 9", age: 14 };

describe("Capture", () => {
  it("submits a typed question", async () => {
    const onSubmit = vi.fn();
    render(<Capture profile={jai} busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /type it/i }));
    await userEvent.type(screen.getByRole("textbox"), "Solve 2x=10");
    await userEvent.click(screen.getByRole("button", { name: /help me/i }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: "text", text: "Solve 2x=10" });
  });

  it("does not submit empty text", async () => {
    const onSubmit = vi.fn();
    render(<Capture profile={jai} busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /type it/i }));
    await userEvent.click(screen.getByRole("button", { name: /help me/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a chosen photo file", async () => {
    const onSubmit = vi.fn();
    render(<Capture profile={jai} busy={false} onSubmit={onSubmit} />);
    const file = new File(["x"], "hw.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText(/take a photo/i) as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(onSubmit).toHaveBeenCalledWith({ kind: "image", file });
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/components/Capture.tsx`**

```tsx
import { useState } from "react";
import type { Profile } from "../types.js";

export type CapturePayload = { kind: "text"; text: string } | { kind: "image"; file: File };

export function Capture({
  profile,
  busy,
  onSubmit,
}: {
  profile: Profile;
  busy: boolean;
  onSubmit: (payload: CapturePayload) => void;
}) {
  const [mode, setMode] = useState<"choose" | "type">("choose");
  const [text, setText] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onSubmit({ kind: "image", file });
  }

  return (
    <div className="screen">
      <h1>Hi {profile.name}! What are we working on?</h1>

      <label className="hero" aria-disabled={busy}>
        <div className="emoji">📸</div>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Take a photo</div>
        <input
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Take a photo"
          disabled={busy}
          onChange={onFile}
        />
      </label>

      {mode === "choose" ? (
        <button className="btn-secondary" type="button" onClick={() => setMode("type")} disabled={busy}>
          ⌨️ Type it instead
        </button>
      ) : (
        <div className="screen">
          <textarea
            className="textarea"
            placeholder="Type your question (and your answer if you have one)…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <button
            className="btn-primary"
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => text.trim() && onSubmit({ kind: "text", text: text.trim() })}
          >
            Help me →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: run it** → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/components/Capture.tsx web/src/components/Capture.test.tsx && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): capture screen (photo hero + type)"
```

---

## Task 7: Results

**Files:** Create `web/src/components/Results.tsx`; Test `web/src/components/Results.test.tsx`.

- [ ] **Step 1: failing test `web/src/components/Results.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Results } from "./Results.js";
import type { TutorResult } from "../types.js";

const result: TutorResult = {
  subject: "maths",
  summary: "Nice work!",
  items: [
    { id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct", feedback: "Yes", hints: [], solution: null },
    { id: "q2", questionText: "5/6-1/3", studentAnswer: "4/3", status: "incorrect", feedback: "Close",
      hints: [
        { level: 1, type: "nudge", text: "n" },
        { level: 2, type: "concept", text: "c" },
        { level: 3, type: "worked_example", text: "w" },
      ], solution: "1/2" },
  ],
};

describe("Results", () => {
  it("shows the summary and one card per question", () => {
    render(<Results result={result} onOpen={vi.fn()} onRetake={vi.fn()} />);
    expect(screen.getByText("Nice work!")).toBeInTheDocument();
    expect(screen.getByText(/5\/6-1\/3/)).toBeInTheDocument();
  });

  it("opens an item when its card is tapped", async () => {
    const onOpen = vi.fn();
    render(<Results result={result} onOpen={onOpen} onRetake={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /5\/6-1\/3/ }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("offers a retake/redo control", async () => {
    const onRetake = vi.fn();
    render(<Results result={result} onOpen={vi.fn()} onRetake={onRetake} />);
    await userEvent.click(screen.getByRole("button", { name: /something look wrong|retake|redo/i }));
    expect(onRetake).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/components/Results.tsx`**

```tsx
import type { TutorResult } from "../types.js";
import { StatusBadge } from "./StatusBadge.js";

export function Results({
  result,
  onOpen,
  onRetake,
}: {
  result: TutorResult;
  onOpen: (index: number) => void;
  onRetake: () => void;
}) {
  const toRevisit = result.items.filter((i) => i.status !== "correct").length;
  return (
    <div className="screen">
      <h2>{result.summary}</h2>
      <p className="subtitle">
        {result.items.length} question{result.items.length === 1 ? "" : "s"}
        {toRevisit > 0 ? ` · ${toRevisit} to revisit` : " · all correct! 🎉"}
      </p>

      {result.items.map((item, i) => (
        <button key={item.id} className={`card ${item.status}`} type="button" onClick={() => onOpen(i)}>
          <StatusBadge status={item.status} />
          <span>
            <strong>{item.questionText}</strong>
            <span className="meta" style={{ display: "block" }}>
              {item.studentAnswer ? `Your answer: ${item.studentAnswer}` : "Left blank"}
            </span>
          </span>
        </button>
      ))}

      <button className="btn-ghost" type="button" onClick={onRetake}>
        Something look wrong? Retake / re-type
      </button>
    </div>
  );
}
```

- [ ] **Step 4: run it** → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/components/Results.tsx web/src/components/Results.test.tsx && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): results list with status cards + retake"
```

---

## Task 8: ProblemDetail — hint reveal + gated solution ★ (core IP)

**Files:** Create `web/src/components/ProblemDetail.tsx`; Test `web/src/components/ProblemDetail.test.tsx`.

Behaviour:
- **Correct item:** show praise feedback + read-aloud only. No hints, no solution control.
- **Non-correct item:** show feedback. Reveal hints one tap at a time. Hints 1 and 2 appear via "Show a hint" / "Show another hint". Hint 3 (the worked example) is gated behind a **second explicit confirm** ("Show the worked example?"). After all 3 hints, a **"Still stuck? Show me how to solve this one"** control, itself gated behind a confirm, reveals the `solution` (the only place the answer appears). Each revealed block has a read-aloud button.

- [ ] **Step 1: failing test `web/src/components/ProblemDetail.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProblemDetail } from "./ProblemDetail.js";
import type { TutorItem } from "../types.js";

const correct: TutorItem = {
  id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct",
  feedback: "Spot on!", hints: [], solution: null,
};
const wrong: TutorItem = {
  id: "q2", questionText: "5/6 - 1/3", studentAnswer: "4/3", status: "incorrect",
  feedback: "Close — bottoms must match.",
  hints: [
    { level: 1, type: "nudge", text: "Can you subtract sixths from thirds directly?" },
    { level: 2, type: "concept", text: "Make a common denominator, e.g. 1/3 = 2/6." },
    { level: 3, type: "worked_example", text: "Try 3/4 - 1/8 = 6/8 - 1/8 = 5/8." },
  ],
  solution: "5/6 - 1/3 = 5/6 - 2/6 = 3/6 = 1/2.",
};

beforeEach(() => {
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
});

describe("ProblemDetail — correct item", () => {
  it("shows praise and offers no hints or solution", () => {
    render(<ProblemDetail item={correct} onBack={vi.fn()} />);
    expect(screen.getByText("Spot on!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /solve this one/i })).not.toBeInTheDocument();
  });
});

describe("ProblemDetail — wrong item", () => {
  it("reveals hints one at a time and gates the worked example + solution", async () => {
    render(<ProblemDetail item={wrong} onBack={vi.fn()} />);

    // No hint text shown initially.
    expect(screen.queryByText(/subtract sixths/i)).not.toBeInTheDocument();

    // Hint 1.
    await userEvent.click(screen.getByRole("button", { name: /show a hint/i }));
    expect(screen.getByText(/subtract sixths/i)).toBeInTheDocument();

    // Hint 2.
    await userEvent.click(screen.getByRole("button", { name: /another hint/i }));
    expect(screen.getByText(/common denominator/i)).toBeInTheDocument();

    // Hint 3 is gated: the worked example is not shown until confirmed.
    expect(screen.queryByText(/3\/4 - 1\/8/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /worked example/i }));
    // a confirm step appears; the example is still hidden until we confirm
    expect(screen.queryByText(/3\/4 - 1\/8/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /yes.*show|show it/i }));
    expect(screen.getByText(/3\/4 - 1\/8/)).toBeInTheDocument();

    // Solution gated behind a confirm; the answer 1/2 is not visible yet.
    expect(screen.queryByText(/3\/6 = 1\/2/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /solve this one/i }));
    expect(screen.queryByText(/3\/6 = 1\/2/)).not.toBeInTheDocument(); // confirm shown, not the answer
    await userEvent.click(screen.getByRole("button", { name: /show me the answer|yes/i }));
    expect(screen.getByText(/3\/6 = 1\/2/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/components/ProblemDetail.tsx`**

```tsx
import { useState } from "react";
import type { TutorItem } from "../types.js";
import { ReadAloudButton } from "./ReadAloudButton.js";

const HINT_LABEL = ["Hint 1 · Nudge", "Hint 2 · Concept", "Hint 3 · Worked example"];

export function ProblemDetail({ item, onBack }: { item: TutorItem; onBack: () => void }) {
  const [revealed, setRevealed] = useState(0); // number of hints shown (0..3)
  const [confirmingExample, setConfirmingExample] = useState(false);
  const [confirmingSolution, setConfirmingSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const isCorrect = item.status === "correct";

  return (
    <div className="screen">
      <button className="btn-ghost" type="button" onClick={onBack}>← Back</button>
      <h2>{item.questionText}</h2>
      {item.studentAnswer && <p className="subtitle">Your answer: {item.studentAnswer}</p>}

      <div className={isCorrect ? "hint" : "card"} style={{ display: "block" }}>
        <p style={{ margin: 0 }}>{item.feedback}</p>
        <ReadAloudButton text={item.feedback} />
      </div>

      {!isCorrect && (
        <>
          {item.hints.slice(0, revealed).map((h, i) => (
            <div className="hint" key={h.level}>
              <div className={`label l${h.level}`}>{HINT_LABEL[i]}</div>
              <p style={{ margin: "4px 0 0" }}>{h.text}</p>
              <ReadAloudButton text={h.text} />
            </div>
          ))}

          {/* Reveal controls */}
          {revealed === 0 && (
            <button className="btn-primary" type="button" onClick={() => setRevealed(1)}>
              💡 Show a hint
            </button>
          )}
          {revealed === 1 && (
            <button className="btn-primary" type="button" onClick={() => setRevealed(2)}>
              💡 Show another hint
            </button>
          )}
          {revealed === 2 && !confirmingExample && (
            <button className="btn-secondary" type="button" onClick={() => setConfirmingExample(true)}>
              Show the worked example
            </button>
          )}
          {revealed === 2 && confirmingExample && (
            <div className="solution">
              <p style={{ margin: "0 0 8px" }}>This shows a full example (with different numbers). Try first?</p>
              <div className="row">
                <button className="btn-secondary" type="button" onClick={() => setConfirmingExample(false)}>
                  Not yet
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => { setRevealed(3); setConfirmingExample(false); }}
                >
                  Yes, show it
                </button>
              </div>
            </div>
          )}

          {/* Solution escape hatch — only after all 3 hints */}
          {revealed === 3 && !showSolution && !confirmingSolution && (
            <button className="btn-secondary" type="button" onClick={() => setConfirmingSolution(true)}>
              😣 Still stuck? Show me how to solve this one
            </button>
          )}
          {revealed === 3 && confirmingSolution && !showSolution && (
            <div className="solution">
              <p style={{ margin: "0 0 8px" }}>This shows the full answer to your question. Sure?</p>
              <div className="row">
                <button className="btn-secondary" type="button" onClick={() => setConfirmingSolution(false)}>
                  Keep trying
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => { setShowSolution(true); setConfirmingSolution(false); }}
                >
                  Yes, show me the answer
                </button>
              </div>
            </div>
          )}
          {showSolution && item.solution && (
            <div className="solution">
              <div className="label" style={{ color: "var(--amber)" }}>HOW TO SOLVE IT</div>
              <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{item.solution}</p>
              <ReadAloudButton text={item.solution} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: run it** → PASS (2 tests). Debug implementation (not tests) until green.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/components/ProblemDetail.tsx web/src/components/ProblemDetail.test.tsx && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): problem detail — accumulating hints + gated worked example & solution"
```

---

## Task 9: History

**Files:** Create `web/src/components/History.tsx`; Test `web/src/components/History.test.tsx`.

- [ ] **Step 1: failing test `web/src/components/History.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { History } from "./History.js";
import type { SubmissionSummary } from "../types.js";

const items: SubmissionSummary[] = [
  { id: "s2", profileId: "jai", createdAt: "2026-06-13T11:00:00Z", subject: "maths", summary: "Good progress", itemCount: 3 },
  { id: "s1", profileId: "jai", createdAt: "2026-06-12T09:00:00Z", subject: "english", summary: "Nice writing", itemCount: 2 },
];

describe("History", () => {
  it("lists submissions and opens one on tap", async () => {
    const onOpen = vi.fn();
    render(<History items={items} onOpen={onOpen} onBack={vi.fn()} />);
    expect(screen.getByText("Good progress")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /nice writing/i }));
    expect(onOpen).toHaveBeenCalledWith("s1");
  });

  it("shows an empty state when there is nothing yet", () => {
    render(<History items={[]} onOpen={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/components/History.tsx`**

```tsx
import type { SubmissionSummary } from "../types.js";

export function History({
  items,
  onOpen,
  onBack,
}: {
  items: SubmissionSummary[];
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="screen">
      <button className="btn-ghost" type="button" onClick={onBack}>← Back</button>
      <h2>Past homework</h2>
      {items.length === 0 && <p className="subtitle">Nothing here yet — snap some homework!</p>}
      {items.map((s) => (
        <button key={s.id} className="card" type="button" onClick={() => onOpen(s.id)}>
          <span>
            <strong>{s.summary}</strong>
            <span className="meta" style={{ display: "block" }}>
              {new Date(s.createdAt).toLocaleDateString()} · {s.subject} · {s.itemCount} question
              {s.itemCount === 1 ? "" : "s"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: run it** → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/components/History.tsx web/src/components/History.test.tsx && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): per-kid history list"
```

---

## Task 10: App — screen state machine + data loading

**Files:** Replace `web/src/App.tsx`; Test `web/src/App.test.tsx`.

The test mocks the `./api.js` module so no network is hit.

- [ ] **Step 1: failing test `web/src/App.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./api.js", () => ({
  ApiError: class extends Error {},
  getProfiles: vi.fn().mockResolvedValue([
    { id: "jai", name: "Jai", level: "Year 9", age: 14 },
    { id: "zane", name: "Zane", level: "Grade 2", age: 8 },
  ]),
  submitText: vi.fn().mockResolvedValue({
    id: "s1",
    result: {
      subject: "maths", summary: "Nice try!",
      items: [{ id: "q1", questionText: "2+2", studentAnswer: "5", status: "incorrect", feedback: "Close",
        hints: [
          { level: 1, type: "nudge", text: "Count again" },
          { level: 2, type: "concept", text: "Add ones" },
          { level: 3, type: "worked_example", text: "1+3=4" },
        ], solution: "2+2=4" }],
    },
  }),
  submitImage: vi.fn(),
  getHistory: vi.fn().mockResolvedValue([]),
  getSubmission: vi.fn(),
}));

import App from "./App.js";

beforeEach(() => vi.clearAllMocks());

describe("App flow", () => {
  it("pick kid → type question → see results → open detail", async () => {
    render(<App />);
    // Profiles load → kid picker.
    await screen.findByRole("button", { name: /jai/i });
    await userEvent.click(screen.getByRole("button", { name: /jai/i }));

    // Capture: type path.
    await userEvent.click(screen.getByRole("button", { name: /type it/i }));
    await userEvent.type(screen.getByRole("textbox"), "2+2");
    await userEvent.click(screen.getByRole("button", { name: /help me/i }));

    // Results.
    await screen.findByText("Nice try!");
    await userEvent.click(screen.getByRole("button", { name: /2\+2/ }));

    // Detail.
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: run it** → FAIL.

- [ ] **Step 3: `web/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import * as api from "./api.js";
import type { Profile, TutorResult, SubmissionSummary } from "./types.js";
import { KidPicker } from "./components/KidPicker.js";
import { Capture, type CapturePayload } from "./components/Capture.js";
import { Results } from "./components/Results.js";
import { ProblemDetail } from "./components/ProblemDetail.js";
import { History } from "./components/History.js";

type Screen = "pick" | "capture" | "loading" | "results" | "detail" | "history";

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("pick");
  const [result, setResult] = useState<TutorResult | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [history, setHistory] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfiles().then(setProfiles).catch((e) => setError(e.message));
  }, []);

  async function submit(payload: CapturePayload) {
    if (!profile) return;
    setScreen("loading");
    setError(null);
    try {
      const res =
        payload.kind === "text"
          ? await api.submitText(profile.id, payload.text)
          : await api.submitImage(profile.id, payload.file);
      setResult(res.result);
      setScreen("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setScreen("capture");
    }
  }

  async function openHistory() {
    if (!profile) return;
    setHistory(await api.getHistory(profile.id).catch(() => []));
    setScreen("history");
  }

  async function openHistoryItem(id: string) {
    const sub = await api.getSubmission(id);
    setResult(sub.result);
    setScreen("results");
  }

  return (
    <div className="app">
      {error && <div className="error">{error}</div>}

      {screen === "pick" && (
        <KidPicker
          profiles={profiles}
          onPick={(p) => { setProfile(p); setScreen("capture"); }}
        />
      )}

      {screen === "capture" && profile && (
        <>
          <Capture profile={profile} busy={false} onSubmit={submit} />
          <button className="btn-ghost" type="button" onClick={openHistory}>Past homework →</button>
          <button className="btn-ghost" type="button" onClick={() => { setProfile(null); setScreen("pick"); }}>
            ← Switch kid
          </button>
        </>
      )}

      {screen === "loading" && <div className="spinner">Reading your homework… ✏️</div>}

      {screen === "results" && result && (
        <Results
          result={result}
          onOpen={(i) => { setItemIndex(i); setScreen("detail"); }}
          onRetake={() => setScreen("capture")}
        />
      )}

      {screen === "detail" && result && (
        <ProblemDetail item={result.items[itemIndex]} onBack={() => setScreen("results")} />
      )}

      {screen === "history" && (
        <History items={history} onOpen={openHistoryItem} onBack={() => setScreen("capture")} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: run it** → PASS. Then run the whole web suite: `cd web && npx vitest run` → all pass.

- [ ] **Step 5: Typecheck/build:** `cd web && npx tsc -b && npm run build` → clean; `dist/` produced.

- [ ] **Step 6: Commit**

```bash
cd /Users/abhayachauhan/kids && git add web/src/App.tsx web/src/App.test.tsx && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(web): app screen state-machine wiring all screens"
```

---

## Task 11: Manual run against the live API (optional)

**Files:** none.

- [ ] **Step 1:** In one terminal: `cd api && npm run dev` (needs `claude login` done; `ANTHROPIC_API_KEY` unset).
- [ ] **Step 2:** In another: `cd web && npm run dev`; open the printed localhost URL on a phone-sized viewport.
- [ ] **Step 3:** Pick a kid → type a wrong sum → verify results, hint reveal gating, and the gated solution. Try the 🔊 buttons. Try a photo via the camera input.
- [ ] **Step 4:** Note any rough edges for polish (not blockers).

---

## Self-Review (completed by author)

**Spec coverage:** two-step entry (KidPicker → Capture) ✓; photo + type input ✓ (voice cut, per spec); per-question status cards w/ badges ✓; accumulating hints one-at-a-time ✓; hint-3 worked example second-confirm gate ✓; "show me" solution gated behind all 3 hints + confirm ✓; read-aloud on feedback/hints/solution ✓; history ✓; warm notebook styling ✓; correction folded into Results retake (documented deviation, spec Risk #2) ✓.

**Placeholder scan:** none — every step has complete code.

**Type consistency:** `CapturePayload` defined in Capture.tsx and imported by App.tsx; `api.ts` return types match `types.ts`; component prop shapes match their call sites in App.tsx; `TutorItem`/`TutorResult`/`Profile`/`SubmissionSummary` used consistently across components and mirror the backend contract.

**Per-kid UI scaling note:** the spec's automatic text-size/word-simplicity scaling by age is intentionally minimal in v1 (the prompt already calibrates wording per kid; read-aloud covers the youngest). A future polish pass can add an age-driven font-scale on `.app` if needed — not built now (YAGNI), flagged so it isn't mistaken for an omission.
