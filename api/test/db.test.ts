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
