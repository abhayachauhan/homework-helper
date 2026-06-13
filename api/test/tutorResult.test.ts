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
    expect(() => parseTutorResult(base)).not.toThrow();
  });

  it("does not leak-check a worded (non-numeric) answer that recurs in a hint", () => {
    const english = {
      ...base,
      items: [{ ...wrongItem, studentAnswer: "dog", solution: "noun",
        hints: [
          { level: 1, type: "nudge", text: "Is 'dog' a naming word?" },
          { level: 2, type: "concept", text: "A noun names a thing, like 'cat'." },
          { level: 3, type: "worked_example", text: "In 'The dog ran', 'dog' is the noun." },
        ] }],
    };
    expect(() => parseTutorResult(english)).not.toThrow();
  });

  it("catches a numeric answer leaked in an earlier hint, not only level 3", () => {
    const leakEarly = {
      ...base,
      items: [{ ...wrongItem, studentAnswer: "7", solution: "7",
        hints: [
          { level: 1, type: "nudge", text: "The answer is 7, can you see why?" },
          wrongHints[1], wrongHints[2],
        ] }],
    };
    expect(() => parseTutorResult(leakEarly)).toThrow(/leaks/);
  });
});
