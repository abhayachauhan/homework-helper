import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { buildServer } from "../src/index.js";
import { assertNoApiKey } from "../src/startup.js";
import { openDb } from "../src/db.js";
import type { TutorResult } from "../src/types.js";

async function multipartImage(boundary: string): Promise<Buffer> {
  const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: "#fff" } }).png().toBuffer();
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="hw.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

const result: TutorResult = {
  subject: "maths", summary: "Good",
  items: [{ id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct", feedback: "Yes", hints: [], solution: null }],
};

function makeServer(opts: { cap?: number; pin?: string } = {}) {
  const db = openDb(":memory:");
  const calls: unknown[] = [];
  const tutorFn = async (input: unknown) => { calls.push(input); return result; };
  const app = buildServer({ db, tutorFn, dailyCap: opts.cap ?? 50, pin: opts.pin, now: () => new Date("2026-06-13T10:00:00Z") });
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

describe("multipart submit", () => {
  it("reads profileId from the query string, tutors the image, and persists", async () => {
    const { app, calls } = makeServer();
    const boundary = "----hhtest";
    const res = await app.inject({
      method: "POST",
      url: "/api/submit?profileId=jai",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: await multipartImage(boundary),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.items).toHaveLength(1);
    expect((calls[0] as { kind: string }).kind).toBe("image");
  });

  it("returns 400 for an unknown profileId in the query (before reading the file)", async () => {
    const { app } = makeServer();
    const boundary = "----hhtest2";
    const res = await app.inject({
      method: "POST",
      url: "/api/submit?profileId=ghost",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: await multipartImage(boundary),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 'no image' when a multipart body carries no file part", async () => {
    const { app } = makeServer();
    const boundary = "----hhtest3";
    const bodyNoFile = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\nhi\r\n--${boundary}--\r\n`
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/submit?profileId=jai",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: bodyNoFile,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/no image/i);
  });
});

describe("pin gate", () => {
  it("GET /api/config returns pinRequired:false when no pin is set", async () => {
    const { app } = makeServer();
    const res = await app.inject({ method: "GET", url: "/api/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pinRequired: false });
  });

  it("POST /api/submit with no pin set allows requests without x-hh-pin header", async () => {
    const { app } = makeServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/submit",
      payload: { profileId: "jai", text: "2+2" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("GET /api/config returns pinRequired:true when pin is set", async () => {
    const { app } = makeServer({ pin: "1234" });
    const res = await app.inject({ method: "GET", url: "/api/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pinRequired: true });
  });

  it("POST /api/pin returns ok:true for correct pin", async () => {
    const { app } = makeServer({ pin: "1234" });
    const res = await app.inject({
      method: "POST",
      url: "/api/pin",
      payload: { pin: "1234" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("POST /api/pin returns 401 for wrong pin", async () => {
    const { app } = makeServer({ pin: "1234" });
    const res = await app.inject({
      method: "POST",
      url: "/api/pin",
      payload: { pin: "9999" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/submit with pin set returns 401 when x-hh-pin header is missing", async () => {
    const { app } = makeServer({ pin: "1234" });
    const res = await app.inject({
      method: "POST",
      url: "/api/submit",
      payload: { profileId: "jai", text: "2+2" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/submit with pin set succeeds when correct x-hh-pin header is provided", async () => {
    const { app } = makeServer({ pin: "1234" });
    const res = await app.inject({
      method: "POST",
      url: "/api/submit",
      payload: { profileId: "jai", text: "2+2" },
      headers: { "content-type": "application/json", "x-hh-pin": "1234" },
    });
    expect(res.statusCode).toBe(200);
  });
});
