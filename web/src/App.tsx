import { useEffect, useState } from "react";
import * as api from "./api.js";
import type { Profile, TutorResult, SubmissionSummary } from "./types.js";
import { KidPicker } from "./components/KidPicker.js";
import { Capture, type CapturePayload } from "./components/Capture.js";
import { Results } from "./components/Results.js";
import { ProblemDetail } from "./components/ProblemDetail.js";
import { History } from "./components/History.js";

type Screen = "pick" | "capture" | "loading" | "results" | "detail" | "history";

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("pick");
  const [result, setResult] = useState<TutorResult | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [history, setHistory] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfiles().then(setProfiles).catch((e) => setError(e.message));
  }, []);

  async function submit(payload: CapturePayload) {
    if (!profile) return;
    setScreen("loading");
    setError(null);
    try {
      const res =
        payload.kind === "text"
          ? await api.submitText(profile.id, payload.text)
          : await api.submitImage(profile.id, payload.file);
      setResult(res.result);
      setScreen("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setScreen("capture");
    }
  }

  async function openHistory() {
    if (!profile) return;
    setHistory(await api.getHistory(profile.id).catch(() => []));
    setScreen("history");
  }

  async function openHistoryItem(id: string) {
    const sub = await api.getSubmission(id);
    setResult(sub.result);
    setScreen("results");
  }

  return (
    <div className="app">
      {error && <div className="error">{error}</div>}

      {screen === "pick" && (
        <KidPicker
          profiles={profiles}
          onPick={(p) => { setProfile(p); setScreen("capture"); }}
        />
      )}

      {screen === "capture" && profile && (
        <>
          <Capture profile={profile} busy={false} onSubmit={submit} />
          <button className="btn-ghost" type="button" onClick={openHistory}>Past homework →</button>
          <button className="btn-ghost" type="button" onClick={() => { setProfile(null); setScreen("pick"); }}>
            ← Switch kid
          </button>
        </>
      )}

      {screen === "loading" && <div className="spinner">Reading your homework… ✏️</div>}

      {screen === "results" && result && (
        <Results
          result={result}
          onOpen={(i) => { setItemIndex(i); setScreen("detail"); }}
          onRetake={() => setScreen("capture")}
        />
      )}

      {screen === "detail" && result && (
        <ProblemDetail item={result.items[itemIndex]} onBack={() => setScreen("results")} />
      )}

      {screen === "history" && (
        <History items={history} onOpen={openHistoryItem} onBack={() => setScreen("capture")} />
      )}
    </div>
  );
}
