import type { TutorResult } from "../types.js";
import { StatusBadge } from "./StatusBadge.js";

export function Results({
  result,
  onOpen,
  onRetake,
  onNew,
}: {
  result: TutorResult;
  onOpen: (index: number) => void;
  onRetake: () => void;
  onNew: () => void;
}) {
  const total = result.items.length;
  const correct = result.items.filter((i) => i.status === "correct").length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="screen">
      <h2 style={{ marginBottom: 4 }}>
        You got {correct}/{total} right ({pct}%){pct === 100 ? " 🎉" : ""}
      </h2>
      {result.summary && <p className="subtitle">{result.summary}</p>}

      {result.items.map((item, i) => (
        <button key={item.id} className={`card ${item.status}`} type="button" onClick={() => onOpen(i)}>
          <StatusBadge status={item.status} />
          <span>
            <strong>{item.questionText}</strong>
            <span className="meta" style={{ display: "block" }}>
              {item.studentAnswer ? `Your answer: ${item.studentAnswer}` : "Left blank"}
            </span>
          </span>
        </button>
      ))}

      <button className="btn-primary" type="button" onClick={onNew} style={{ marginTop: 8 }}>
        📸 Start again (new worksheet)
      </button>
      <button className="btn-ghost" type="button" onClick={onRetake}>
        Something look wrong? Retake / re-type
      </button>
    </div>
  );
}
