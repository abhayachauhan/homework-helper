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
export const PIN = process.env.HH_PIN ?? "";

export function getProfile(id: string): Profile | undefined {
  return PROFILES.find((p) => p.id === id);
}
