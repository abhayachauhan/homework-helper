import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Capture } from "./Capture.js";
import type { Profile } from "../types.js";

const jai: Profile = { id: "jai", name: "Jai", level: "Year 9", age: 14 };

describe("Capture", () => {
  it("submits a typed question", async () => {
    const onSubmit = vi.fn();
    render(<Capture profile={jai} busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /type it/i }));
    await userEvent.type(screen.getByRole("textbox"), "Solve 2x=10");
    await userEvent.click(screen.getByRole("button", { name: /help me/i }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: "text", text: "Solve 2x=10" });
  });

  it("does not submit empty text", async () => {
    const onSubmit = vi.fn();
    render(<Capture profile={jai} busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /type it/i }));
    await userEvent.click(screen.getByRole("button", { name: /help me/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a chosen photo file", async () => {
    const onSubmit = vi.fn();
    render(<Capture profile={jai} busy={false} onSubmit={onSubmit} />);
    const file = new File(["x"], "hw.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText(/take a photo/i) as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(onSubmit).toHaveBeenCalledWith({ kind: "image", file });
  });
});
