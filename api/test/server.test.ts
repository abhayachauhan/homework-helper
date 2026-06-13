import { describe, it, expect } from "vitest";
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
