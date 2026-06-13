import type { Profile } from "../types.js";

export function KidPicker({ profiles, onPick }: { profiles: Profile[]; onPick: (p: Profile) => void }) {
  return (
    <div className="screen">
      <h1>Who's doing homework?</h1>
      <p className="subtitle">Tap your name to start.</p>
      {profiles.map((p) => (
        <button key={p.id} className="kid-btn" type="button" onClick={() => onPick(p)}>
          {p.name}
          <span className="lvl">{p.level}</span>
        </button>
      ))}
    </div>
  );
}
