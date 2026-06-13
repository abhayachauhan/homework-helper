import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Loading } from "./Loading.js";

describe("Loading", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a progress bar that advances while waiting (never exceeds 100)", () => {
    render(<Loading />);
    const start = Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
    act(() => { vi.advanceTimersByTime(2000); });
    const later = Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
    expect(later).toBeGreaterThan(start);
    expect(later).toBeLessThanOrEqual(100);
  });

  it("shows a fun joke/fact and rotates to a different one over time", () => {
    const { container } = render(<Loading />);
    const first = container.querySelector(".quip")?.textContent ?? "";
    expect(first.length).toBeGreaterThan(5);
    act(() => { vi.advanceTimersByTime(4000); });
    const second = container.querySelector(".quip")?.textContent ?? "";
    expect(second.length).toBeGreaterThan(5);
    expect(second).not.toBe(first);
  });
});
