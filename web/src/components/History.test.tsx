import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { History } from "./History.js";
import type { SubmissionSummary } from "../types.js";

const items: SubmissionSummary[] = [
  { id: "s2", profileId: "jai", createdAt: "2026-06-13T11:00:00Z", subject: "maths", summary: "Good progress", itemCount: 3 },
  { id: "s1", profileId: "jai", createdAt: "2026-06-12T09:00:00Z", subject: "english", summary: "Nice writing", itemCount: 2 },
];

describe("History", () => {
  it("lists submissions and opens one on tap", async () => {
    const onOpen = vi.fn();
    render(<History items={items} onOpen={onOpen} onBack={vi.fn()} />);
    expect(screen.getByText("Good progress")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /nice writing/i }));
    expect(onOpen).toHaveBeenCalledWith("s1");
  });

  it("shows an empty state when there is nothing yet", () => {
    render(<History items={[]} onOpen={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });
});
