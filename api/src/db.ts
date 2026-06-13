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
