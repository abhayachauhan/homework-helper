import { describe, it, expect } from "vitest";
import { PROFILES, getProfile, DAILY_SUBMISSION_CAP } from "../src/config.js";

describe("config", () => {
  it("has the three kids with levels and ages", () => {
    expect(PROFILES.map((p) => p.id)).toEqual(["jai", "keeran", "zane"]);
    expect(getProfile("zane")).toMatchObject({ name: "Zane", level: "Grade 2", age: 8 });
    expect(getProfile("jai")).toMatchObject({ level: "Year 9", age: 14 });
  });
  it("returns undefined for an unknown profile", () => {
    expect(getProfile("nobody")).toBeUndefined();
  });
  it("has a positive daily cap", () => {
    expect(DAILY_SUBMISSION_CAP).toBeGreaterThan(0);
  });
});
