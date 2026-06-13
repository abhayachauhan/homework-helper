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
  it("instructs simple, age-appropriate language the kid can read themselves", () => {
    const p = buildSystemPrompt(zane).toLowerCase();
    expect(p).toMatch(/simple|easily (read|understand)|reading level/);
    expect(p).toMatch(/short sentences|everyday words|avoid jargon/);
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
  it("specifies the hint object shape with a 'text' field (not 'hint')", () => {
    const p = buildSystemPrompt(jai);
    expect(p).toMatch(/"level".*"type".*"text"/);
    expect(p).toMatch(/"text"/);
  });
  it("requires the 3 hints to be a connected step-by-step chain on the actual question, flagging multi-step", () => {
    const p = buildSystemPrompt(jai).toLowerCase();
    expect(p).toMatch(/connected chain|continues from|same solution path/);
    expect(p).toMatch(/first step|multiple steps|step 1/);
    expect(p).toMatch(/actual question/);
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
