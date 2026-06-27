import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Results } from "./Results.js";
import type { TutorResult } from "../types.js";

const result: TutorResult = {
  subject: "maths",
  summary: "Nice work!",
  items: [
    { id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct", feedback: "Yes", hints: [], solution: null },
    { id: "q2", questionText: "5/6-1/3", studentAnswer: "4/3", status: "incorrect", feedback: "Close",
      hints: [
        { level: 1, type: "nudge", text: "n" },
        { level: 2, type: "concept", text: "c" },
        { level: 3, type: "worked_example", text: "w" },
      ], solution: "1/2" },
  ],
};

describe("Results", () => {
  it("shows the summary and one card per question", () => {
    render(<Results result={result} onOpen={vi.fn()} onRetake={vi.fn()} onNew={vi.fn()} />);
    expect(screen.getByText("Nice work!")).toBeInTheDocument();
    expect(screen.getByText(/5\/6-1\/3/)).toBeInTheDocument();
  });

  it("opens an item when its card is tapped", async () => {
    const onOpen = vi.fn();
    render(<Results result={result} onOpen={onOpen} onRetake={vi.fn()} onNew={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /5\/6-1\/3/ }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("offers a retake/redo control", async () => {
    const onRetake = vi.fn();
    render(<Results result={result} onOpen={vi.fn()} onRetake={onRetake} onNew={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /something look wrong|retake|redo/i }));
    expect(onRetake).toHaveBeenCalled();
  });

  it("offers a 'start again' button", async () => {
    const onNew = vi.fn();
    render(<Results result={result} onOpen={vi.fn()} onRetake={vi.fn()} onNew={onNew} />);
    await userEvent.click(screen.getByRole("button", { name: /start again/i }));
    expect(onNew).toHaveBeenCalled();
  });
});
