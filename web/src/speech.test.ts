import { describe, it, expect, vi, beforeEach } from "vitest";
import { speak, stopSpeaking, speechSupported } from "./speech.js";

describe("speech", () => {
  beforeEach(() => {
    vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  });

  it("reports supported when speechSynthesis exists", () => {
    expect(speechSupported()).toBe(true);
  });

  it("cancels any current speech then speaks the text", () => {
    speak("hello there");
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce();
    const utt = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(utt.text).toBe("hello there");
  });

  it("stopSpeaking cancels", () => {
    stopSpeaking();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it("does not throw when speechSynthesis is unavailable", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(() => speak("x")).not.toThrow();
    expect(speechSupported()).toBe(false);
  });
});
