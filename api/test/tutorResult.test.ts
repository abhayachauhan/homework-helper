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

  it("accepts a solution and hints that contain numbers (no programmatic leak check)", () => {
    // The student's (often wrong) answer recurring in counting/working is fine; only
    // the prompt enforces not stating the CORRECT answer in hints.
    const counting = {
      ...base,
      items: [{ ...wrongItem, studentAnswer: "8", solution: "12 - 5 = 7",
        hints: [
          { level: 1, type: "nudge", text: "Count back from 12 on your fingers." },
          { level: 2, type: "concept", text: "Count back 5: 11, 10, 9, 8, 7." },
          { level: 3, type: "worked_example", text: "10 - 4: count back 9, 8, 7, 6, so 6." },
        ] }],
    };
    expect(() => parseTutorResult(counting)).not.toThrow();
  });
});
