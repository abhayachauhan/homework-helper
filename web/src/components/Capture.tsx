import { useState } from "react";
import type { Profile } from "../types.js";

export type CapturePayload = { kind: "text"; text: string } | { kind: "image"; file: File };

export function Capture({
  profile,
  busy,
  onSubmit,
}: {
  profile: Profile;
  busy: boolean;
  onSubmit: (payload: CapturePayload) => void;
}) {
  const [mode, setMode] = useState<"choose" | "type">("choose");
  const [text, setText] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onSubmit({ kind: "image", file });
  }

  return (
    <div className="screen">
      <h1>Hi {profile.name}! What are we working on?</h1>

      <label className="hero" aria-disabled={busy}>
        <div className="emoji">📸</div>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Take a photo</div>
        <input
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Take a photo"
          disabled={busy}
          onChange={onFile}
        />
      </label>

      {mode === "choose" ? (
        <button className="btn-secondary" type="button" onClick={() => setMode("type")} disabled={busy}>
          ⌨️ Type it instead
        </button>
      ) : (
        <div className="screen">
          <textarea
            className="textarea"
            placeholder="Type your question (and your answer if you have one)…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <button
            className="btn-primary"
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => text.trim() && onSubmit({ kind: "text", text: text.trim() })}
          >
            Help me →
          </button>
        </div>
      )}
    </div>
  );
}
