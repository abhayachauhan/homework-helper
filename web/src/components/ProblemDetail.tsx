import { useState } from "react";
import type { TutorItem } from "../types.js";
import { ReadAloudButton } from "./ReadAloudButton.js";

const HINT_LABEL = ["Hint 1 · Nudge", "Hint 2 · Concept", "Hint 3 · Worked example"];

export function ProblemDetail({ item, onBack, onNew }: { item: TutorItem; onBack: () => void; onNew: () => void }) {
  const [revealed, setRevealed] = useState(0); // number of hints shown (0..3)
  const [confirmingExample, setConfirmingExample] = useState(false);
  const [confirmingSolution, setConfirmingSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const isCorrect = item.status === "correct";

  return (
    <div className="screen">
      <h2>{item.questionText}</h2>
      {item.studentAnswer && <p className="subtitle">Your answer: {item.studentAnswer}</p>}

      <div className={isCorrect ? "hint" : "card"} style={{ display: "block" }}>
        <p style={{ margin: 0 }}>{item.feedback}</p>
        <ReadAloudButton text={item.feedback} />
      </div>

      {!isCorrect && (
        <>
          {item.hints.slice(0, revealed).map((h, i) => (
            <div className="hint" key={h.level}>
              <div className={`label l${h.level}`}>{HINT_LABEL[i]}</div>
              <p style={{ margin: "4px 0 0" }}>{h.text}</p>
              <ReadAloudButton text={h.text} />
            </div>
          ))}

          {/* Reveal controls */}
          {revealed === 0 && (
            <button className="btn-primary" type="button" onClick={() => setRevealed(1)}>
              💡 Show a hint
            </button>
          )}
          {revealed === 1 && (
            <button className="btn-primary" type="button" onClick={() => setRevealed(2)}>
              💡 Show another hint
            </button>
          )}
          {revealed === 2 && !confirmingExample && (
            <button className="btn-secondary" type="button" onClick={() => setConfirmingExample(true)}>
              Show the worked example
            </button>
          )}
          {revealed === 2 && confirmingExample && (
            <div className="solution">
              <p style={{ margin: "0 0 8px" }}>This shows a full example (with different numbers). Try first?</p>
              <div className="row">
                <button className="btn-secondary" type="button" onClick={() => setConfirmingExample(false)}>
                  Not yet
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => { setRevealed(3); setConfirmingExample(false); }}
                >
                  Yes, show it
                </button>
              </div>
            </div>
          )}

          {/* Solution escape hatch — only after all 3 hints */}
          {revealed === 3 && !showSolution && !confirmingSolution && (
            <button className="btn-secondary" type="button" onClick={() => setConfirmingSolution(true)}>
              😣 Still stuck? Show me how to solve this one
            </button>
          )}
          {revealed === 3 && confirmingSolution && !showSolution && (
            <div className="solution">
              <p style={{ margin: "0 0 8px" }}>This shows the full answer to your question. Sure?</p>
              <div className="row">
                <button className="btn-secondary" type="button" onClick={() => setConfirmingSolution(false)}>
                  Keep trying
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => { setShowSolution(true); setConfirmingSolution(false); }}
                >
                  Yes, show me the answer
                </button>
              </div>
            </div>
          )}
          {showSolution && item.solution && (
            <div className="solution">
              <div className="label" style={{ color: "var(--amber)" }}>HOW TO SOLVE IT</div>
              <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{item.solution}</p>
              <ReadAloudButton text={item.solution} />
            </div>
          )}
        </>
      )}

      <button className="btn-primary" type="button" onClick={onBack} style={{ marginTop: 8 }}>
        ← Back to my questions
      </button>
      <button className="btn-ghost" type="button" onClick={onNew}>
        📸 Start again (new worksheet)
      </button>
    </div>
  );
}
