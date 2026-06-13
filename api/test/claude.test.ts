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
