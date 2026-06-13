import { useEffect, useState } from "react";
import * as api from "./api.js";
import type { Profile, TutorResult, SubmissionSummary } from "./types.js";
import { KidPicker } from "./components/KidPicker.js";
import { Capture, type CapturePayload } from "./components/Capture.js";
import { Results } from "./components/Results.js";
import { ProblemDetail } from "./components/ProblemDetail.js";
import { History } from "./components/History.js";
import { Loading } from "./components/Loading.js";
import { PinGate } from "./components/PinGate.js";

type Screen = "pick" | "capture" | "loading" | "results" | "detail" | "history";

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("pick");
  const [result, setResult] = useState<TutorResult | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [history, setHistory] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    api.getProfiles().then(setProfiles).catch((e) => setError(e.message));
    api.getConfig().then((c) => {
      if (c.pinRequired && !localStorage.getItem("hh_pin")) setLocked(true);
    }).catch(() => {});
  }, []);

  async function submit(payload: CapturePayload) {
    if (!profile || submitting) return;
    setSubmitting(true);
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
      if (e instanceof api.ApiError && e.status === 401) {
        localStorage.removeItem("hh_pin");
        setLocked(true);
        setScreen("capture");
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong");
      setScreen("capture");
    } finally {
      setSubmitting(false);
    }
  }

  async function openHistory() {
    if (!profile) return;
    setHistory(await api.getHistory(profile.id).catch(() => []));
    setScreen("history");
  }

  async function openHistoryItem(id: string) {
    setError(null);
    try {
      const sub = await api.getSubmission(id);
      setResult(sub.result);
      setScreen("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that one");
    }
  }

  if (locked) {
    return (
      <div className="app">
        <PinGate onUnlock={() => setLocked(false)} />
      </div>
    );
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
          <Capture profile={profile} busy={submitting} onSubmit={submit} />
          <button className="btn-ghost" type="button" onClick={openHistory}>Past homework →</button>
          <button className="btn-ghost" type="button" onClick={() => { setProfile(null); setScreen("pick"); }}>
            ← Switch kid
          </button>
        </>
      )}

      {screen === "loading" && <Loading />}

      {screen === "results" && result && (
        <Results
          result={result}
          onOpen={(i) => { setItemIndex(i); setScreen("detail"); }}
          onRetake={() => setScreen("capture")}
          onNew={() => { setResult(null); setScreen("capture"); }}
        />
      )}

      {screen === "detail" && result && (
        <ProblemDetail
          item={result.items[itemIndex]}
          onBack={() => setScreen("results")}
          onNew={() => { setResult(null); setScreen("capture"); }}
        />
      )}

      {screen === "history" && (
        <History items={history} onOpen={openHistoryItem} onBack={() => setScreen("capture")} />
      )}
    </div>
  );
}
