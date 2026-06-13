import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api.js", () => ({ checkPin: vi.fn() }));
import { checkPin } from "../api.js";
import { PinGate } from "./PinGate.js";

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(() => localStorage.clear());

describe("PinGate", () => {
  it("unlocks and stores the pin on a correct entry", async () => {
    (checkPin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const onUnlock = vi.fn();
    render(<PinGate onUnlock={onUnlock} />);
    await userEvent.type(screen.getByLabelText("PIN"), "032407");
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));
    expect(onUnlock).toHaveBeenCalled();
    expect(localStorage.getItem("hh_pin")).toBe("032407");
  });

  it("shows an error and does not unlock on a wrong entry", async () => {
    (checkPin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const onUnlock = vi.fn();
    render(<PinGate onUnlock={onUnlock} />);
    await userEvent.type(screen.getByLabelText("PIN"), "111111");
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));
    expect(await screen.findByText(/not right/i)).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(localStorage.getItem("hh_pin")).toBeNull();
  });
});
