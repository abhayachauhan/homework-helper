import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge.js";

describe("StatusBadge", () => {
  it("shows a tick for correct and a label for unanswered", () => {
    const { rerender } = render(<StatusBadge status="correct" />);
    expect(screen.getByLabelText(/correct/i)).toBeInTheDocument();
    rerender(<StatusBadge status="unanswered" />);
    expect(screen.getByLabelText(/unanswered/i)).toBeInTheDocument();
  });
});
