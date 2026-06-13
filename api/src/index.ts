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
      // profileId comes from the query string (NOT a form field) so it is immune to
      // multipart field-ordering: the image is the only part in the body.
      const profileId = (req.query as { profileId?: string }).profileId ?? "";
      if (!getProfile(profileId)) return reply.code(400).send({ message: "unknown profileId" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @fastify/multipart augments req at runtime; no stable generic available
      const file = await (req as any).file();
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

  const here = dirname(fileURLToPath(import.meta.url));
  const webDist = join(here, "..", "..", "web", "dist");
  app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) return reply.code(404).send({ message: "not found" });
    return reply.sendFile("index.html", webDist);
  });

  const port = Number(process.env.PORT ?? 8080);
  await app.listen({ host: "0.0.0.0", port });
  console.log(`homework-helper api listening on :${port}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
