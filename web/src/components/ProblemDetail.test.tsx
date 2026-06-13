import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProblemDetail } from "./ProblemDetail.js";
import type { TutorItem } from "../types.js";

const correct: TutorItem = {
  id: "q1", questionText: "2+2", studentAnswer: "4", status: "correct",
  feedback: "Spot on!", hints: [], solution: null,
};
const wrong: TutorItem = {
  id: "q2", questionText: "5/6 - 1/3", studentAnswer: "4/3", status: "incorrect",
  feedback: "Close — bottoms must match.",
  hints: [
    { level: 1, type: "nudge", text: "Can you subtract sixths from thirds directly?" },
    { level: 2, type: "concept", text: "Make a common denominator, e.g. 1/3 = 2/6." },
    { level: 3, type: "worked_example", text: "Try 3/4 - 1/8 = 6/8 - 1/8 = 5/8." },
  ],
  solution: "5/6 - 1/3 = 5/6 - 2/6 = 3/6 = 1/2.",
};

beforeEach(() => {
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
});

describe("ProblemDetail — correct item", () => {
  it("shows praise and offers no hints or solution", () => {
    render(<ProblemDetail item={correct} onBack={vi.fn()} />);
    expect(screen.getByText("Spot on!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /solve this one/i })).not.toBeInTheDocument();
  });
});

describe("ProblemDetail — wrong item", () => {
  it("reveals hints one at a time and gates the worked example + solution", async () => {
    render(<ProblemDetail item={wrong} onBack={vi.fn()} />);

    // No hint text shown initially.
    expect(screen.queryByText(/subtract sixths/i)).not.toBeInTheDocument();

    // Hint 1.
    await userEvent.click(screen.getByRole("button", { name: /show a hint/i }));
    expect(screen.getByText(/subtract sixths/i)).toBeInTheDocument();

    // Hint 2.
    await userEvent.click(screen.getByRole("button", { name: /another hint/i }));
    expect(screen.getByText(/common denominator/i)).toBeInTheDocument();

    // Hint 3 is gated: the worked example is not shown until confirmed.
    expect(screen.queryByText(/3\/4 - 1\/8/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /worked example/i }));
    // a confirm step appears; the example is still hidden until we confirm
    expect(screen.queryByText(/3\/4 - 1\/8/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /yes.*show|show it/i }));
    expect(screen.getByText(/3\/4 - 1\/8/)).toBeInTheDocument();

    // Solution gated behind a confirm; the answer 1/2 is not visible yet.
    expect(screen.queryByText(/3\/6 = 1\/2/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /solve this one/i }));
    expect(screen.queryByText(/3\/6 = 1\/2/)).not.toBeInTheDocument(); // confirm shown, not the answer
    await userEvent.click(screen.getByRole("button", { name: /show me the answer|yes/i }));
    expect(screen.getByText(/3\/6 = 1\/2/)).toBeInTheDocument();
  });
});
