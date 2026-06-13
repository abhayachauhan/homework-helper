import { useState } from "react";
import { checkPin } from "../api.js";

export function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(false);
    const ok = await checkPin(pin);
    setBusy(false);
    if (ok) {
      localStorage.setItem("hh_pin", pin);
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div className="screen">
      <h1>Enter the family PIN 🔒</h1>
      <p className="subtitle">Ask a grown-up if you don't know it.</p>
      <input
        className="textarea"
        style={{ minHeight: "auto", fontSize: 28, textAlign: "center", letterSpacing: 8 }}
        type="password"
        inputMode="numeric"
        aria-label="PIN"
        placeholder="••••••"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && pin) submit(); }}
      />
      {error && <p className="error">That PIN's not right — try again.</p>}
      <button className="btn-primary" type="button" disabled={busy || !pin} onClick={submit}>
        Unlock
      </button>
    </div>
  );
}
