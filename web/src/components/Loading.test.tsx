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

  it("keeps a joke/fact steady for ~10s, then rotates to a different one", () => {
    const { container } = render(<Loading />);
    const first = container.querySelector(".quip")?.textContent ?? "";
    expect(first.length).toBeGreaterThan(5);
    // Still the same just before the 10s mark (no longer changes at 4s).
    act(() => { vi.advanceTimersByTime(4000); });
    expect(container.querySelector(".quip")?.textContent).toBe(first);
    // Rotates after the full 10s interval.
    act(() => { vi.advanceTimersByTime(6000); });
    const second = container.querySelector(".quip")?.textContent ?? "";
    expect(second.length).toBeGreaterThan(5);
    expect(second).not.toBe(first);
  });
});
