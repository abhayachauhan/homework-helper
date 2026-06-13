import type { Status } from "../types.js";

const MAP: Record<Status, { emoji: string; label: string }> = {
  correct: { emoji: "✅", label: "Correct" },
  partial: { emoji: "🟡", label: "Partly there" },
  incorrect: { emoji: "❌", label: "Not quite" },
  unanswered: { emoji: "⭕", label: "Unanswered" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { emoji, label } = MAP[status];
  return (
    <span className="badge" role="img" aria-label={label}>
      {emoji}
    </span>
  );
}
