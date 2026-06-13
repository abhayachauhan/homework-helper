import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./api.js", () => ({
  ApiError: class extends Error {},
  getProfiles: vi.fn().mockResolvedValue([
    { id: "jai", name: "Jai", level: "Year 9", age: 14 },
    { id: "zane", name: "Zane", level: "Grade 2", age: 8 },
  ]),
  getConfig: vi.fn().mockResolvedValue({ pinRequired: false }),
  checkPin: vi.fn(),
  submitText: vi.fn().mockResolvedValue({
    id: "s1",
    result: {
      subject: "maths", summary: "Nice try!",
      items: [{ id: "q1", questionText: "2+2", studentAnswer: "5", status: "incorrect", feedback: "Close",
        hints: [
          { level: 1, type: "nudge", text: "Count again" },
          { level: 2, type: "concept", text: "Add ones" },
          { level: 3, type: "worked_example", text: "1+3=4" },
        ], solution: "2+2=4" }],
    },
  }),
  submitImage: vi.fn(),
  getHistory: vi.fn().mockResolvedValue([]),
  getSubmission: vi.fn(),
}));

import App from "./App.js";

beforeEach(() => vi.clearAllMocks());

describe("App flow", () => {
  it("pick kid → type question → see results → open detail", async () => {
    render(<App />);
    // Profiles load → kid picker.
    await screen.findByRole("button", { name: /jai/i });
    await userEvent.click(screen.getByRole("button", { name: /jai/i }));

    // Capture: type path.
    await userEvent.click(screen.getByRole("button", { name: /type it/i }));
    await userEvent.type(screen.getByRole("textbox"), "2+2");
    await userEvent.click(screen.getByRole("button", { name: /help me/i }));

    // Results.
    await screen.findByText("Nice try!");
    await userEvent.click(screen.getByRole("button", { name: /2\+2/ }));

    // Detail.
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
