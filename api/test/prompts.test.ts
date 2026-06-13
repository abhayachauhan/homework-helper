import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserInstruction } from "../src/prompts.js";
import { getProfile } from "../src/config.js";

const zane = getProfile("zane")!;
const jai = getProfile("jai")!;

describe("buildSystemPrompt", () => {
  it("injects the kid's name, level and age", () => {
    const p = buildSystemPrompt(zane);
    expect(p).toContain("Zane");
    expect(p).toContain("Grade 2");
    expect(p).toContain("8");
  });
  it("states the golden rule, the 3-hint structure, and the solution escape hatch", () => {
    const p = buildSystemPrompt(jai);
    expect(p.toLowerCase()).toMatch(/never (state|give|reveal).*answer/);
    expect(p).toMatch(/nudge/);
    expect(p).toMatch(/concept/);
    expect(p).toMatch(/worked_example/);
    expect(p.toLowerCase()).toContain("solution");
    expect(p.toLowerCase()).toContain("json");
  });
});

describe("buildUserInstruction", () => {
  it("for typed input includes the question text", () => {
    const msg = buildUserInstruction(jai, { kind: "text", profileId: "jai", text: "Solve x^2-5x+6=0" });
    expect(msg).toContain("Solve x^2-5x+6=0");
  });
  it("for image input references a photo and the kid", () => {
    const msg = buildUserInstruction(zane, {
      kind: "image", profileId: "zane", imageBase64: "AAAA", mediaType: "image/jpeg",
    });
    expect(msg.toLowerCase()).toContain("photo");
    expect(msg).toContain("Zane");
  });
});
