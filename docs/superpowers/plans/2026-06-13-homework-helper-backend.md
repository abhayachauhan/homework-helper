# Homework Helper — Backend API Implementation Plan (1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fastify backend that turns a homework photo (or typed text) into validated, per-question Socratic tutoring JSON, persists per-kid history, and enforces a daily request cap.

**Architecture:** A thin Fastify HTTP layer over pure, independently-tested units: `tutorResult.ts` (zod schema + pedagogy invariants), `prompts.ts` (system/user prompt builders), `claude.ts` (Agent SDK call + parse + one retry, with an injectable runner so tests never hit the network), `images.ts` (sharp → base64), `db.ts` (better-sqlite3 persistence + daily counter). Claude is reached via `@anthropic-ai/claude-agent-sdk` on the Max subscription (no `ANTHROPIC_API_KEY`).

**Tech Stack:** Node 20 (ESM), TypeScript, Fastify, `@fastify/multipart`, `@fastify/static`, `better-sqlite3`, `sharp`, `zod`, `nanoid`, `@anthropic-ai/claude-agent-sdk`; Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-06-13-homework-helper-design.md`

---

## File Structure

```
api/
├─ package.json          deps + scripts (test, dev, build)
├─ tsconfig.json         NodeNext ESM, strict
├─ vitest.config.ts      node environment
└─ src/
   ├─ types.ts           Status, HintType, Subject, Hint, TutorItem, TutorResult, Profile
   ├─ config.ts          PROFILES (3 kids), MODEL, DAILY_SUBMISSION_CAP, DB_PATH, MAX_IMAGE_EDGE, getProfile()
   ├─ tutorResult.ts     zod schema + parseTutorResult() + answer-leak guard  (pure, no I/O)
   ├─ prompts.ts         buildSystemPrompt(profile), buildUserInstruction(profile, input), TutorInput
   ├─ images.ts          resizeToBase64(buffer) via sharp
   ├─ db.ts              openDb, saveSubmission, listHistory, getSubmission, bumpDailyCount, getDailyCount
   ├─ claude.ts          callModelOnce (real SDK) + tutor(input, run?) → validated TutorResult, 1 retry
   ├─ startup.ts         assertNoApiKey()
   └─ index.ts           buildServer(deps) + start(); routes; static SPA serving
test/  (colocated under api/test/)
   ├─ config.test.ts  tutorResult.test.ts  prompts.test.ts
   ├─ images.test.ts  db.test.ts  claude.test.ts  server.test.ts
```

Design notes locked in here:
- **`tutor(input, run)` takes an injectable `QueryRunner`.** Tests pass a fake runner returning canned model text — so no test ever imports/mocks the SDK or hits the network. `callModelOnce` is the real runner.
- **`buildServer(deps)` injects `db` and a `tutorFn`.** Server tests drive routes with a stub tutor and an in-memory db.
- All dates are injected (`now = new Date()`) so time-based logic (daily cap, history order) is deterministic.

---

## Task 0: Scaffold the `api/` project

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/vitest.config.ts`
- Create: `api/src/types.ts` (placeholder so tsc has an entry)

- [ ] **Step 1: Create `api/package.json`**

```json
{
  "name": "homework-helper-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "@fastify/multipart": "^8.3.0",
    "@fastify/static": "^7.0.4",
    "better-sqlite3": "^11.3.0",
    "fastify": "^4.28.1",
    "nanoid": "^5.0.7",
    "sharp": "^0.33.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `api/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create a placeholder `api/src/types.ts`**

```ts
export {};
```

- [ ] **Step 5: Install dependencies**

Run: `cd api && npm install`
Expected: completes; `node_modules/` created. (sharp + better-sqlite3 download native binaries — needs network.)

- [ ] **Step 6: Verify the test runner works**

Run: `cd api && npx vitest run`
Expected: exits 0 with "No test files found" (or runs 0 tests). Toolchain is alive.

- [ ] **Step 7: Verify the Agent SDK surface (de-risks Task 6)**

Run: `cd api && node -e "import('@anthropic-ai/claude-agent-sdk').then(m=>console.log(Object.keys(m)))"`
Expected: prints exported names; confirm `query` is present. Then open
`api/node_modules/@anthropic-ai/claude-agent-sdk/dist/*.d.ts` and note the real option
names for `query()` (model, systemPrompt, maxTurns, allowedTools, permissionMode) and
the shape of streamed messages. **If they differ from Task 6's code, adjust Task 6 to match.**

- [ ] **Step 8: Commit**

```bash
git add api/package.json api/tsconfig.json api/vitest.config.ts api/src/types.ts
git commit -m "chore(api): scaffold backend project (ts, vitest, deps)"
```

---

## Task 1: Shared types + config

**Files:**
- Modify: `api/src/types.ts`
- Create: `api/src/config.ts`
- Test: `api/test/config.test.ts`

- [ ] **Step 1: Write the failing test** — `api/test/config.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { PROFILES, getProfile, DAILY_SUBMISSION_CAP } from "../src/config.js";

describe("config", () => {
  it("has the three kids with levels and ages", () => {
    expect(PROFILES.map((p) => p.id)).toEqual(["jai", "keeran", "zane"]);
    expect(getProfile("zane")).toMatchObject({ name: "Zane", level: "Grade 2", age: 8 });
    expect(getProfile("jai")).toMatchObject({ level: "Year 9", age: 14 });
  });
  it("returns undefined for an unknown profile", () => {
    expect(getProfile("nobody")).toBeUndefined();
  });
  it("has a positive daily cap", () => {
    expect(DAILY_SUBMISSION_CAP).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/config.test.ts`
Expected: FAIL — cannot find module `../src/config.js`.

- [ ] **Step 3: Fill in `api/src/types.ts`**

```ts
export type Status = "correct" | "partial" | "incorrect" | "unanswered";
export type HintType = "nudge" | "concept" | "worked_example";
export type Subject = "maths" | "english" | "mixed";

export interface Hint {
  level: 1 | 2 | 3;
  type: HintType;
  text: string;
}

export interface TutorItem {
  id: string;
  questionText: string;
  studentAnswer: string | null;
  status: Status;
  feedback: string;
  hints: Hint[];
  solution: string | null;
}

export interface TutorResult {
  subject: Subject;
  summary: string;
  items: TutorItem[];
}

export interface Profile {
  id: string;
  name: string;
  level: string; // e.g. "Year 9", "Grade 6", "Grade 2"
  age: number;
}
```

- [ ] **Step 4: Create `api/src/config.ts`**

```ts
import type { Profile } from "./types.js";

export const PROFILES: Profile[] = [
  { id: "jai", name: "Jai", level: "Year 9", age: 14 },
  { id: "keeran", name: "Keeran", level: "Grade 6", age: 12 },
  { id: "zane", name: "Zane", level: "Grade 2", age: 8 },
];

export const MODEL = "claude-sonnet-4-6";
export const DAILY_SUBMISSION_CAP = Number(process.env.HH_DAILY_CAP ?? 50);
export const DB_PATH = process.env.HH_DB_PATH ?? "./data/homework.db";
export const MAX_IMAGE_EDGE = 1600;

export function getProfile(id: string): Profile | undefined {
  return PROFILES.find((p) => p.id === id);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd api && npx vitest run test/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/types.ts api/src/config.ts api/test/config.test.ts
git commit -m "feat(api): shared types and kid profiles config"
```

---

## Task 2: Tutor result validator (`tutorResult.ts`) — the core invariants

**Files:**
- Create: `api/src/tutorResult.ts`
- Test: `api/test/tutorResult.test.ts`

This pure module is the source of truth for the pedagogy rules. No I/O — fully unit-tested.

- [ ] **Step 1: Write the failing test** — `api/test/tutorResult.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseTutorResult, TutorValidationError } from "../src/tutorResult.js";

const correctItem = {
  id: "q1", questionText: "2+2", studentAnswer: "4",
  status: "correct", feedback: "Nice!", hints: [], solution: null,
};
const wrongHints = [
  { level: 1, type: "nudge", text: "What do the bottoms need to be?" },
  { level: 2, type: "concept", text: "Common denominator first, e.g. 1/2 = 2/4." },
  { level: 3, type: "worked_example", text: "Try 3/4 - 1/8: rewrite as 6/8 - 1/8 = 5/8." },
];
const wrongItem = {
  id: "q2", questionText: "5/6 - 1/3", studentAnswer: "4/3",
  status: "incorrect", feedback: "Close!", hints: wrongHints,
  solution: "5/6 - 1/3 = 5/6 - 2/6 = 3/6 = 1/2.",
};
const base = { subject: "maths", summary: "Good effort", items: [correctItem, wrongItem] };

describe("parseTutorResult", () => {
  it("accepts a valid result", () => {
    expect(parseTutorResult(base).items).toHaveLength(2);
  });

  it("rejects unknown top-level keys", () => {
    expect(() => parseTutorResult({ ...base, extra: 1 })).toThrow(TutorValidationError);
  });

  it("requires zero hints and null solution for correct items", () => {
    const bad = { ...base, items: [{ ...correctItem, hints: wrongHints }] };
    expect(() => parseTutorResult(bad)).toThrow(/zero hints/);
    const bad2 = { ...base, items: [{ ...correctItem, solution: "4" }] };
    expect(() => parseTutorResult(bad2)).toThrow(/null solution/);
  });

  it("requires exactly 3 hints in nudge,concept,worked_example order for non-correct", () => {
    const twoHints = { ...base, items: [{ ...wrongItem, hints: wrongHints.slice(0, 2) }] };
    expect(() => parseTutorResult(twoHints)).toThrow(/exactly 3 hints/);
    const reordered = {
      ...base,
      items: [{ ...wrongItem, hints: [wrongHints[1], wrongHints[0], wrongHints[2]] }],
    };
    expect(() => parseTutorResult(reordered)).toThrow(/levels 1,2,3|out of order/);
  });

  it("requires a non-empty solution for non-correct items", () => {
    const noSol = { ...base, items: [{ ...wrongItem, solution: null }] };
    expect(() => parseTutorResult(noSol)).toThrow(/must have a solution/);
  });

  it("rejects a worked example that leaks the student's numeric answer", () => {
    const leak = {
      ...base,
      items: [{ ...wrongItem, studentAnswer: "1/2",
        hints: [wrongHints[0], wrongHints[1],
          { level: 3, type: "worked_example", text: "The result is 1/2 here." }] }],
    };
    expect(() => parseTutorResult(leak)).toThrow(/leaks/);
  });

  it("allows the solution field to contain the answer", () => {
    // wrongItem.solution contains '1/2'; studentAnswer is '4/3' — solution is exempt anyway
    expect(() => parseTutorResult(base)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/tutorResult.test.ts`
Expected: FAIL — cannot find module `../src/tutorResult.js`.

- [ ] **Step 3: Create `api/src/tutorResult.ts`**

```ts
import { z } from "zod";
import type { TutorResult } from "./types.js";

const hintSchema = z
  .object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    type: z.enum(["nudge", "concept", "worked_example"]),
    text: z.string().min(1),
  })
  .strict();

const itemSchema = z
  .object({
    id: z.string().min(1),
    questionText: z.string().min(1),
    studentAnswer: z.string().nullable(),
    status: z.enum(["correct", "partial", "incorrect", "unanswered"]),
    feedback: z.string().min(1),
    hints: z.array(hintSchema),
    solution: z.string().min(1).nullable(),
  })
  .strict();

const resultSchema = z
  .object({
    subject: z.enum(["maths", "english", "mixed"]),
    summary: z.string().min(1),
    items: z.array(itemSchema).min(1),
  })
  .strict();

export class TutorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TutorValidationError";
  }
}

const NUMBER_RE = /-?\d+(?:\.\d+)?/g;

/** True if any numeric token from `answer` appears as a standalone number in `text`. */
function leaksAnswer(answer: string, text: string): boolean {
  const tokens = answer.match(NUMBER_RE);
  if (!tokens) return false;
  for (const tok of tokens) {
    const escaped = tok.replace(/[.]/g, "\\.");
    const standalone = new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`);
    if (standalone.test(text)) return true;
  }
  return false;
}

export function parseTutorResult(raw: unknown): TutorResult {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) throw new TutorValidationError(parsed.error.message);

  for (const item of parsed.data.items) {
    if (item.status === "correct") {
      if (item.hints.length !== 0)
        throw new TutorValidationError(`item ${item.id}: correct items must have zero hints`);
      if (item.solution !== null)
        throw new TutorValidationError(`item ${item.id}: correct items must have a null solution`);
      continue;
    }
    if (item.hints.length !== 3)
      throw new TutorValidationError(`item ${item.id}: non-correct items need exactly 3 hints`);
    const levels = item.hints.map((h) => h.level).join(",");
    if (levels !== "1,2,3")
      throw new TutorValidationError(`item ${item.id}: hints must be levels 1,2,3 in order`);
    const types = item.hints.map((h) => h.type).join(",");
    if (types !== "nudge,concept,worked_example")
      throw new TutorValidationError(`item ${item.id}: hint types out of order`);
    if (!item.solution)
      throw new TutorValidationError(`item ${item.id}: non-correct items must have a solution`);
    if (item.studentAnswer && leaksAnswer(item.studentAnswer, item.hints[2].text))
      throw new TutorValidationError(`item ${item.id}: worked example leaks the student's answer`);
  }

  return parsed.data as TutorResult;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx vitest run test/tutorResult.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/tutorResult.ts api/test/tutorResult.test.ts
git commit -m "feat(api): tutor result schema + pedagogy invariants + answer-leak guard"
```

---

## Task 3: Prompt builders (`prompts.ts`)

**Files:**
- Create: `api/src/prompts.ts`
- Test: `api/test/prompts.test.ts`

- [ ] **Step 1: Write the failing test** — `api/test/prompts.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserInstruction } from "../src/prompts.js";
import { getProfile } from "../src/config.js";

const zane = getProfile("zane")!;
const jai = getProfile("jai")!;

describe("buildSystemPrompt", () => {
  it("injects the kid's name, level and age", () => {
    const p = buildSystemPrompt(zane);
    expect(p).toContain("Zane");
    expect(p).toContain("Grade 2");
    expect(p).toContain("8");
  });
  it("states the golden rule, the 3-hint structure, and the solution escape hatch", () => {
    const p = buildSystemPrompt(jai);
    expect(p.toLowerCase()).toMatch(/never (state|give|reveal).*answer/);
    expect(p).toMatch(/nudge/);
    expect(p).toMatch(/concept/);
    expect(p).toMatch(/worked_example/);
    expect(p.toLowerCase()).toContain("solution");
    expect(p.toLowerCase()).toContain("json");
  });
});

describe("buildUserInstruction", () => {
  it("for typed input includes the question text", () => {
    const msg = buildUserInstruction(jai, { kind: "text", profileId: "jai", text: "Solve x^2-5x+6=0" });
    expect(msg).toContain("Solve x^2-5x+6=0");
  });
  it("for image input references a photo and the kid", () => {
    const msg = buildUserInstruction(zane, {
      kind: "image", profileId: "zane", imageBase64: "AAAA", mediaType: "image/jpeg",
    });
    expect(msg.toLowerCase()).toContain("photo");
    expect(msg).toContain("Zane");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/prompts.test.ts`
Expected: FAIL — cannot find module `../src/prompts.js`.

- [ ] **Step 3: Create `api/src/prompts.ts`**

```ts
import type { Profile } from "./types.js";

export type TutorInput =
  | { kind: "text"; profileId: string; text: string }
  | { kind: "image"; profileId: string; imageBase64: string; mediaType: string };

export function buildSystemPrompt(p: Profile): string {
  return [
    `You are a warm, encouraging Socratic homework tutor for ${p.name}, who is in ${p.level} (age ${p.age}).`,
    `Subjects: maths and English. Calibrate every word, number, and example to a ${p.level} student (age ${p.age}); for young kids use simple words and small concrete steps.`,
    ``,
    `Mark the homework and respond with ONLY a JSON object of this exact shape:`,
    `{"subject":"maths"|"english"|"mixed","summary":string,"items":[{"id":string,"questionText":string,"studentAnswer":string|null,"status":"correct"|"partial"|"incorrect"|"unanswered","feedback":string,"hints":[],"solution":null}]}`,
    ``,
    `RULES:`,
    `1. Classify each question: "correct", "partial", "incorrect", or "unanswered".`,
    `2. For every NON-correct item, give EXACTLY 3 progressive hints in this order:`,
    `   - level 1, type "nudge": a gentle question that points their attention.`,
    `   - level 2, type "concept": the rule/method, WITH a short concrete example.`,
    `   - level 3, type "worked_example": a fully solved example using DIFFERENT (and where helpful SIMPLER) numbers/wording than their actual question.`,
    `3. GOLDEN RULE: the hints must NEVER state the answer to the kid's actual question. Lead them to it; do not hand it over.`,
    `4. ALSO provide "solution": a full step-by-step worked solution of the kid's ACTUAL question, answer included. The app hides it until the kid explicitly asks, so it is allowed to contain the answer.`,
    `5. For CORRECT items: warm praise in "feedback", "hints": [], "solution": null.`,
    `6. Output ONLY the JSON object. No markdown fences, no prose before or after.`,
  ].join("\n");
}

export function buildUserInstruction(p: Profile, input: TutorInput): string {
  if (input.kind === "text") {
    return `Here is ${p.name}'s homework, typed out:\n\n${input.text}\n\nMark it and respond with the JSON object only.`;
  }
  return `Here is a photo of ${p.name}'s homework. Read each question and ${p.name}'s answer, then mark it and respond with the JSON object only.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx vitest run test/prompts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/prompts.ts api/test/prompts.test.ts
git commit -m "feat(api): system + user prompt builders with per-kid calibration"
```

---

## Task 4: Image normalisation (`images.ts`)

**Files:**
- Create: `api/src/images.ts`
- Test: `api/test/images.test.ts`

- [ ] **Step 1: Write the failing test** — `api/test/images.test.ts`

```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { resizeToBase64 } from "../src/images.js";

describe("resizeToBase64", () => {
  it("downscales a large image and returns base64 jpeg", async () => {
    const big = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#888" },
    }).png().toBuffer();

    const { base64, mediaType } = await resizeToBase64(big);
    expect(mediaType).toBe("image/jpeg");
    expect(base64.length).toBeGreaterThan(0);

    const meta = await sharp(Buffer.from(base64, "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/images.test.ts`
Expected: FAIL — cannot find module `../src/images.js`.

- [ ] **Step 3: Create `api/src/images.ts`**

```ts
import sharp from "sharp";
import { MAX_IMAGE_EDGE } from "./config.js";

export interface NormalisedImage {
  base64: string;
  mediaType: "image/jpeg";
}

export async function resizeToBase64(buf: Buffer): Promise<NormalisedImage> {
  const out = await sharp(buf)
    .rotate() // honour EXIF orientation, then strip metadata
    .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return { base64: out.toString("base64"), mediaType: "image/jpeg" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx vitest run test/images.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add api/src/images.ts api/test/images.test.ts
git commit -m "feat(api): image resize/normalise to base64 jpeg"
```

---

## Task 5: Persistence + daily cap (`db.ts`)

**Files:**
- Create: `api/src/db.ts`
- Test: `api/test/db.test.ts`

- [ ] **Step 1: Write the failing test** — `api/test/db.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { openDb, saveSubmission, listHistory, getSubmission, bumpDailyCount, getDailyCount } from "../src/db.js";
import type { TutorResult } from "../src/types.js";

const result: TutorResult = {
  subject: "maths", summary: "Good effort",
  items: [
    { id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct", feedback: "Nice!", hints: [], solution: null },
    { id: "q2", questionText: "5/6-1/3", studentAnswer: "4/3", status: "incorrect", feedback: "Close",
      hints: [
        { level: 1, type: "nudge", text: "n" },
        { level: 2, type: "concept", text: "c" },
        { level: 3, type: "worked_example", text: "w" },
      ], solution: "1/2" },
  ],
};

function db() { return openDb(":memory:"); }

describe("submissions", () => {
  it("saves and reads back a full submission", () => {
    const d = db();
    const id = saveSubmission(d, "keeran", result, new Date("2026-06-13T10:00:00Z"));
    const got = getSubmission(d, id);
    expect(got?.profileId).toBe("keeran");
    expect(got?.result.items).toHaveLength(2);
    expect(got?.result.items[1].solution).toBe("1/2");
  });

  it("lists a kid's history newest-first with item counts", () => {
    const d = db();
    saveSubmission(d, "jai", result, new Date("2026-06-13T09:00:00Z"));
    saveSubmission(d, "jai", result, new Date("2026-06-13T11:00:00Z"));
    saveSubmission(d, "zane", result, new Date("2026-06-13T12:00:00Z"));
    const hist = listHistory(d, "jai");
    expect(hist).toHaveLength(2);
    expect(new Date(hist[0].createdAt).getTime()).toBeGreaterThan(new Date(hist[1].createdAt).getTime());
    expect(hist[0].itemCount).toBe(2);
  });
});

describe("daily cap", () => {
  it("increments per-day and reports the count", () => {
    const d = db();
    expect(getDailyCount(d, "2026-06-13")).toBe(0);
    expect(bumpDailyCount(d, "2026-06-13")).toBe(1);
    expect(bumpDailyCount(d, "2026-06-13")).toBe(2);
    expect(bumpDailyCount(d, "2026-06-14")).toBe(1);
    expect(getDailyCount(d, "2026-06-13")).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/db.test.ts`
Expected: FAIL — cannot find module `../src/db.js`.

- [ ] **Step 3: Create `api/src/db.ts`**

```ts
import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { TutorResult } from "./types.js";

export type DB = Database.Database;

export interface SubmissionSummary {
  id: string;
  profileId: string;
  createdAt: string;
  subject: string;
  summary: string;
  itemCount: number;
}

export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      subject TEXT NOT NULL,
      summary TEXT NOT NULL,
      items_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_profile ON submissions(profile_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS daily_counts (
      day TEXT PRIMARY KEY,
      count INTEGER NOT NULL
    );
  `);
  return db;
}

export function saveSubmission(db: DB, profileId: string, result: TutorResult, now = new Date()): string {
  const id = nanoid();
  db.prepare(
    `INSERT INTO submissions (id, profile_id, created_at, subject, summary, items_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, profileId, now.toISOString(), result.subject, result.summary, JSON.stringify(result.items));
  return id;
}

export function listHistory(db: DB, profileId: string): SubmissionSummary[] {
  const rows = db
    .prepare(
      `SELECT id, profile_id, created_at, subject, summary, items_json
       FROM submissions WHERE profile_id = ? ORDER BY created_at DESC`
    )
    .all(profileId) as Array<Record<string, string>>;
  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    createdAt: r.created_at,
    subject: r.subject,
    summary: r.summary,
    itemCount: (JSON.parse(r.items_json) as unknown[]).length,
  }));
}

export function getSubmission(
  db: DB,
  id: string
): { id: string; profileId: string; createdAt: string; result: TutorResult } | undefined {
  const r = db
    .prepare(`SELECT id, profile_id, created_at, subject, summary, items_json FROM submissions WHERE id = ?`)
    .get(id) as Record<string, string> | undefined;
  if (!r) return undefined;
  return {
    id: r.id,
    profileId: r.profile_id,
    createdAt: r.created_at,
    result: { subject: r.subject as TutorResult["subject"], summary: r.summary, items: JSON.parse(r.items_json) },
  };
}

export function bumpDailyCount(db: DB, day: string): number {
  db.prepare(
    `INSERT INTO daily_counts (day, count) VALUES (?, 1)
     ON CONFLICT(day) DO UPDATE SET count = count + 1`
  ).run(day);
  const row = db.prepare(`SELECT count FROM daily_counts WHERE day = ?`).get(day) as { count: number };
  return row.count;
}

export function getDailyCount(db: DB, day: string): number {
  const row = db.prepare(`SELECT count FROM daily_counts WHERE day = ?`).get(day) as { count: number } | undefined;
  return row?.count ?? 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx vitest run test/db.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/db.ts api/test/db.test.ts
git commit -m "feat(api): sqlite persistence + per-day request counter"
```

---

## Task 6: Claude call + retry (`claude.ts`)

**Files:**
- Create: `api/src/claude.ts`
- Test: `api/test/claude.test.ts`

`tutor()` takes an injectable `QueryRunner`, so tests never touch the SDK. `callModelOnce`
is the real runner — **verify its option names against the `.d.ts` from Task 0 Step 7 and
adjust if needed.**

- [ ] **Step 1: Write the failing test** — `api/test/claude.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { tutor } from "../src/claude.js";
import { TutorValidationError } from "../src/tutorResult.js";

const valid = JSON.stringify({
  subject: "maths", summary: "Nice work",
  items: [{ id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct", feedback: "Yes!", hints: [], solution: null }],
});

describe("tutor", () => {
  it("returns a validated result from clean model JSON", async () => {
    const run = vi.fn().mockResolvedValue(valid);
    const res = await tutor({ kind: "text", profileId: "jai", text: "2+2" }, run);
    expect(res.items[0].status).toBe("correct");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("strips ```json fences before parsing", async () => {
    const run = vi.fn().mockResolvedValue("```json\n" + valid + "\n```");
    const res = await tutor({ kind: "text", profileId: "jai", text: "2+2" }, run);
    expect(res.summary).toBe("Nice work");
  });

  it("retries once on malformed output, then succeeds", async () => {
    const run = vi.fn().mockResolvedValueOnce("not json at all").mockResolvedValueOnce(valid);
    const res = await tutor({ kind: "text", profileId: "jai", text: "2+2" }, run);
    expect(res.items).toHaveLength(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("throws TutorValidationError after the retry also fails", async () => {
    const run = vi.fn().mockResolvedValue("still not json");
    await expect(tutor({ kind: "text", profileId: "jai", text: "2+2" }, run)).rejects.toBeInstanceOf(TutorValidationError);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("rejects an unknown profile id", async () => {
    const run = vi.fn().mockResolvedValue(valid);
    await expect(tutor({ kind: "text", profileId: "ghost", text: "2+2" }, run)).rejects.toThrow(/profile/);
    expect(run).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/claude.test.ts`
Expected: FAIL — cannot find module `../src/claude.js`.

- [ ] **Step 3: Create `api/src/claude.ts`**

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { MODEL, getProfile } from "./config.js";
import { buildSystemPrompt, buildUserInstruction, type TutorInput } from "./prompts.js";
import { parseTutorResult, TutorValidationError } from "./tutorResult.js";
import type { TutorResult } from "./types.js";

export interface RunArgs {
  system: string;
  userText: string;
  image?: { base64: string; mediaType: string };
}
export type QueryRunner = (args: RunArgs) => Promise<string>;

/** Pull the first balanced JSON object out of model text (handles ```json fences / stray prose). */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return body.trim();
  return body.slice(start, end + 1);
}

/** Real runner: one Agent SDK call, no tools, single turn. */
export const callModelOnce: QueryRunner = async ({ system, userText, image }) => {
  const prompt = image
    ? [
        {
          type: "user" as const,
          message: {
            role: "user" as const,
            content: [
              { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
              { type: "text", text: userText },
            ],
          },
        },
      ]
    : userText;

  let text = "";
  for await (const msg of query({
    // NOTE (Task 0 Step 7): confirm these option names against the installed .d.ts.
    prompt: prompt as never,
    options: { model: MODEL, systemPrompt: system, maxTurns: 1, allowedTools: [], permissionMode: "bypassPermissions" },
  })) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") text += block.text;
      }
    }
  }
  return text;
};

export async function tutor(input: TutorInput, run: QueryRunner = callModelOnce): Promise<TutorResult> {
  const profile = getProfile(input.profileId);
  if (!profile) throw new Error(`unknown profile: ${input.profileId}`);

  const system = buildSystemPrompt(profile);
  const userText = buildUserInstruction(profile, input);
  const image = input.kind === "image" ? { base64: input.imageBase64, mediaType: input.mediaType } : undefined;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await run({ system, userText, image });
    try {
      return parseTutorResult(JSON.parse(extractJson(raw)));
    } catch (err) {
      lastErr = err instanceof SyntaxError ? new TutorValidationError(`model returned non-JSON: ${err.message}`) : err;
      if (!(lastErr instanceof TutorValidationError)) throw lastErr;
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx vitest run test/claude.test.ts`
Expected: PASS (5 tests). If the SDK's `query` option names differ (Task 0 Step 7), only `callModelOnce` needs adjusting — the tested `tutor()` logic is unaffected because tests inject `run`.

- [ ] **Step 5: Commit**

```bash
git add api/src/claude.ts api/test/claude.test.ts
git commit -m "feat(api): tutor orchestration with json extraction + one retry"
```

---

## Task 7: Server, routes, startup guard (`startup.ts` + `index.ts`)

**Files:**
- Create: `api/src/startup.ts`
- Create: `api/src/index.ts`
- Test: `api/test/server.test.ts`

- [ ] **Step 1: Write the failing test** — `api/test/server.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildServer } from "../src/index.js";
import { assertNoApiKey } from "../src/startup.js";
import { openDb } from "../src/db.js";
import type { TutorResult } from "../src/types.js";

const result: TutorResult = {
  subject: "maths", summary: "Good",
  items: [{ id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct", feedback: "Yes", hints: [], solution: null }],
};

function makeServer(opts: { cap?: number } = {}) {
  const db = openDb(":memory:");
  const calls: unknown[] = [];
  const tutorFn = async (input: unknown) => { calls.push(input); return result; };
  const app = buildServer({ db, tutorFn, dailyCap: opts.cap ?? 50, now: () => new Date("2026-06-13T10:00:00Z") });
  return { app, db, calls };
}

describe("startup guard", () => {
  it("throws when ANTHROPIC_API_KEY is set", () => {
    expect(() => assertNoApiKey({ ANTHROPIC_API_KEY: "sk-xxx" })).toThrow(/ANTHROPIC_API_KEY/);
  });
  it("passes when it is absent", () => {
    expect(() => assertNoApiKey({})).not.toThrow();
  });
});

describe("routes", () => {
  it("GET /api/profiles returns the three kids", async () => {
    const { app } = makeServer();
    const res = await app.inject({ method: "GET", url: "/api/profiles" });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((p: any) => p.id)).toEqual(["jai", "keeran", "zane"]);
  });

  it("POST /api/submit with text tutors, persists, and returns the result", async () => {
    const { app, calls } = makeServer();
    const res = await app.inject({
      method: "POST", url: "/api/submit",
      payload: { profileId: "jai", text: "2+2" }, headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.items).toHaveLength(1);
    expect(typeof res.json().id).toBe("string");
    expect(calls).toHaveLength(1);

    const hist = await app.inject({ method: "GET", url: "/api/history?profileId=jai" });
    expect(hist.json()).toHaveLength(1);
  });

  it("rejects submit with an unknown profile (400)", async () => {
    const { app } = makeServer();
    const res = await app.inject({
      method: "POST", url: "/api/submit",
      payload: { profileId: "ghost", text: "2+2" }, headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 429 once the daily cap is exceeded", async () => {
    const { app } = makeServer({ cap: 1 });
    const ok = await app.inject({ method: "POST", url: "/api/submit", payload: { profileId: "jai", text: "a" }, headers: { "content-type": "application/json" } });
    expect(ok.statusCode).toBe(200);
    const capped = await app.inject({ method: "POST", url: "/api/submit", payload: { profileId: "jai", text: "b" }, headers: { "content-type": "application/json" } });
    expect(capped.statusCode).toBe(429);
    expect(capped.json().message).toMatch(/today/i);
  });

  it("GET /api/submission/:id returns a stored result, 404 when missing", async () => {
    const { app } = makeServer();
    const created = await app.inject({ method: "POST", url: "/api/submit", payload: { profileId: "zane", text: "1+1" }, headers: { "content-type": "application/json" } });
    const id = created.json().id;
    const got = await app.inject({ method: "GET", url: `/api/submission/${id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().result.summary).toBe("Good");
    const missing = await app.inject({ method: "GET", url: "/api/submission/nope" });
    expect(missing.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/server.test.ts`
Expected: FAIL — cannot find module `../src/index.js` / `../src/startup.js`.

- [ ] **Step 3: Create `api/src/startup.ts`**

```ts
export function assertNoApiKey(env: NodeJS.ProcessEnv | Record<string, string | undefined>): void {
  if (env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is set — refusing to start. This app must bill the Max " +
        "subscription via the Agent SDK; an API key would silently switch to pay-as-you-go. " +
        "Unset it (and ensure docker-compose does not forward it)."
    );
  }
}
```

- [ ] **Step 4: Create `api/src/index.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PROFILES, getProfile, DAILY_SUBMISSION_CAP, DB_PATH } from "./config.js";
import { openDb, saveSubmission, listHistory, getSubmission, bumpDailyCount, getDailyCount, type DB } from "./db.js";
import { tutor } from "./claude.js";
import { resizeToBase64 } from "./images.js";
import { assertNoApiKey } from "./startup.js";
import type { TutorInput } from "./prompts.js";
import type { TutorResult } from "./types.js";

export interface ServerDeps {
  db: DB;
  tutorFn: (input: TutorInput) => Promise<TutorResult>;
  dailyCap: number;
  now?: () => Date;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: false });
  app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } });

  app.get("/api/profiles", async () => PROFILES);

  app.get("/api/history", async (req, reply) => {
    const profileId = (req.query as { profileId?: string }).profileId;
    if (!profileId || !getProfile(profileId)) return reply.code(400).send({ message: "unknown profileId" });
    return listHistory(deps.db, profileId);
  });

  app.get("/api/submission/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const found = getSubmission(deps.db, id);
    if (!found) return reply.code(404).send({ message: "not found" });
    return found;
  });

  app.post("/api/submit", async (req, reply) => {
    const day = dayKey(now());
    if (getDailyCount(deps.db, day) >= deps.dailyCap) {
      return reply.code(429).send({ message: "That's enough homework help for today — try again tomorrow!" });
    }

    let input: TutorInput;
    if (req.isMultipart()) {
      const file = await (req as any).file();
      const profileId = (file?.fields?.profileId?.value as string) ?? "";
      if (!getProfile(profileId)) return reply.code(400).send({ message: "unknown profileId" });
      if (!file) return reply.code(400).send({ message: "no image" });
      const buf = await file.toBuffer();
      const { base64, mediaType } = await resizeToBase64(buf);
      input = { kind: "image", profileId, imageBase64: base64, mediaType };
    } else {
      const body = (req.body ?? {}) as { profileId?: string; text?: string };
      if (!body.profileId || !getProfile(body.profileId)) return reply.code(400).send({ message: "unknown profileId" });
      if (!body.text?.trim()) return reply.code(400).send({ message: "no text" });
      input = { kind: "text", profileId: body.profileId, text: body.text };
    }

    let result: TutorResult;
    try {
      result = await deps.tutorFn(input);
    } catch {
      return reply.code(502).send({ message: "Couldn't read that one — try again with a clearer photo." });
    }

    bumpDailyCount(deps.db, day);
    const id = saveSubmission(deps.db, input.profileId, result, now());
    return { id, result };
  });

  return app;
}

async function start(): Promise<void> {
  assertNoApiKey(process.env);
  const db = openDb(DB_PATH);
  const app = buildServer({ db, tutorFn: (i) => tutor(i), dailyCap: DAILY_SUBMISSION_CAP });

  // Serve the built SPA (web/dist) if present.
  const here = dirname(fileURLToPath(import.meta.url));
  const webDist = join(here, "..", "..", "web", "dist");
  app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) return reply.code(404).send({ message: "not found" });
    return reply.sendFile("index.html", webDist);
  });

  const port = Number(process.env.PORT ?? 8080);
  await app.listen({ host: "0.0.0.0", port });
  // eslint-disable-next-line no-console
  console.log(`homework-helper api listening on :${port}`);
}

// Only auto-start when run directly (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd api && npx vitest run test/server.test.ts`
Expected: PASS (8 tests). If `@fastify/static` complains about a missing `web/dist` during
the imported-build path, note that tests use `buildServer` directly (no static registration),
so it should not trigger; only `start()` registers static.

- [ ] **Step 6: Run the whole suite**

Run: `cd api && npm test`
Expected: ALL tests pass across config, tutorResult, prompts, images, db, claude, server.

- [ ] **Step 7: Typecheck the build**

Run: `cd api && npm run build`
Expected: `tsc` completes with no errors; `dist/` produced.

- [ ] **Step 8: Commit**

```bash
git add api/src/startup.ts api/src/index.ts api/test/server.test.ts
git commit -m "feat(api): fastify routes, daily cap, startup guard, SPA serving"
```

---

## Task 8: Manual smoke test against the real model (optional, costs credits)

**Files:** none (manual verification)

- [ ] **Step 1: Log in to Claude once** (the Agent SDK uses these creds)

Run: `npx @anthropic-ai/claude-code login` (or `claude login` if installed)
Expected: browser auth completes; `~/.claude` populated. Ensure `ANTHROPIC_API_KEY` is unset.

- [ ] **Step 2: Start the API**

Run: `cd api && npm run dev`
Expected: "homework-helper api listening on :8080".

- [ ] **Step 3: Submit a typed question**

Run:
```bash
curl -s localhost:8080/api/submit -H 'content-type: application/json' \
  -d '{"profileId":"keeran","text":"Question: 5/6 - 1/3 = ?  My answer: 4/3"}' | json_pp
```
Expected: JSON with `id` and `result`; the incorrect item has exactly 3 hints
(nudge/concept/worked_example), none stating `1/2`, and a non-null `solution` that *does*
contain `1/2`.

- [ ] **Step 4: Confirm it was persisted**

Run: `curl -s 'localhost:8080/api/history?profileId=keeran' | json_pp`
Expected: one entry with `itemCount` ≥ 1.

- [ ] **Step 5: Note any SDK option drift**

If Step 3 errored inside `callModelOnce`, reconcile its `query()` options with the installed
`.d.ts` (Task 0 Step 7), fix, re-run. Commit any fix:
```bash
git add api/src/claude.ts && git commit -m "fix(api): align Agent SDK query options with installed sdk"
```

---

## Self-Review (completed by author)

**Spec coverage:**
- Profiles w/ level+age → Task 1 ✓ · Pedagogy invariants + answer-leak (hints-only) + solution escape hatch → Task 2 ✓ · Per-kid prompt w/ golden rule + solution → Task 3 ✓ · Image normalise → Task 4 ✓ · SQLite history + daily cap → Task 5 ✓ · One-call tutor + retry → Task 6 ✓ · Routes (`/api/profiles`, `/api/submit` photo+text, `/api/history`, `/api/submission/:id`), daily-cap 429, startup guard, SPA serving → Task 7 ✓ · No-`ANTHROPIC_API_KEY` billing guard → Task 7 ✓.
- Deferred to later plans (by design): read-aloud, all UI screens (Plan 2 — frontend); Dockerfile/compose/LXC/Cloudflare Tunnel (Plan 3 — deploy). The transcribe-then-confirm correction UX is a frontend concern; this backend treats each submit as one tutoring call, and the frontend's "edit text → resubmit" simply posts corrected text — no backend change needed.

**Placeholder scan:** none — every step has complete code/commands.

**Type consistency:** `TutorInput` (prompts.ts) used identically in claude.ts and index.ts; `QueryRunner`/`tutor(input, run)` signatures match tests; `buildServer(deps)` shape matches server tests; db function names (`saveSubmission`, `listHistory`, `getSubmission`, `bumpDailyCount`, `getDailyCount`) consistent across db.ts, tests, and index.ts.
