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

// Only numeric/fraction answers are leak-checked (per spec). A worded answer like
// "dog" legitimately recurring in a different worked example must NOT be treated as
// a leak — that would wrongly reject valid English-homework feedback.
function isNumericAnswer(answer: string): boolean {
  const a = answer.trim();
  return /\d/.test(a) && /^[\d\s.,/\-+()]+$/.test(a);
}

function leaksAnswer(answer: string, text: string): boolean {
  // Check the full answer appears as a standalone token — not adjacent to a word
  // char or dot that would make it part of a different number/word/fraction.
  const escaped = answer.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const standalone = new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`);
  return standalone.test(text);
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
    if (item.studentAnswer && isNumericAnswer(item.studentAnswer)) {
      // Guard every hint (especially the level-3 worked example) from leaking a
      // numeric answer.
      if (item.hints.some((h) => leaksAnswer(item.studentAnswer as string, h.text)))
        throw new TutorValidationError(`item ${item.id}: a hint leaks the student's answer`);
    }
  }

  return parsed.data as TutorResult;
}
