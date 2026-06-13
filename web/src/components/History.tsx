import type { SubmissionSummary } from "../types.js";

export function History({
  items,
  onOpen,
  onBack,
}: {
  items: SubmissionSummary[];
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="screen">
      <button className="btn-ghost" type="button" onClick={onBack}>← Back</button>
      <h2>Past homework</h2>
      {items.length === 0 && <p className="subtitle">Nothing here yet — snap some homework!</p>}
      {items.map((s) => (
        <button key={s.id} className="card" type="button" onClick={() => onOpen(s.id)}>
          <span>
            <strong>{s.summary}</strong>
            <span className="meta" style={{ display: "block" }}>
              {new Date(s.createdAt).toLocaleDateString()} · {s.subject} · {s.itemCount} question
              {s.itemCount === 1 ? "" : "s"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
