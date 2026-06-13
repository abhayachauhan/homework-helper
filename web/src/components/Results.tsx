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
  const toRevisit = result.items.filter((i) => i.status !== "correct").length;
  return (
    <div className="screen">
      <h2>{result.summary}</h2>
      <p className="subtitle">
        {result.items.length} question{result.items.length === 1 ? "" : "s"}
        {toRevisit > 0 ? ` · ${toRevisit} to revisit` : " · all correct! 🎉"}
      </p>

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
        📸 Start a new question
      </button>
      <button className="btn-ghost" type="button" onClick={onRetake}>
        Something look wrong? Retake / re-type
      </button>
    </div>
  );
}
