import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KidPicker } from "./KidPicker.js";
import type { Profile } from "../types.js";

const profiles: Profile[] = [
  { id: "jai", name: "Jai", level: "Year 9", age: 14 },
  { id: "keeran", name: "Keeran", level: "Grade 6", age: 12 },
  { id: "zane", name: "Zane", level: "Grade 2", age: 8 },
];

describe("KidPicker", () => {
  it("renders a button per kid and calls onPick with the chosen profile", async () => {
    const onPick = vi.fn();
    render(<KidPicker profiles={profiles} onPick={onPick} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /keeran/i }));
    expect(onPick).toHaveBeenCalledWith(profiles[1]);
  });
});
