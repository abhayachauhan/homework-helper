import { useEffect, useState } from "react";

const QUIPS: string[] = [
  "Why did the maths book look so sad? Because it had too many problems! 📖",
  "Fun fact: Honey never goes off — people have eaten 3,000-year-old honey! 🍯",
  "Why was 6 scared of 7? Because 7 8 9! 😅",
  "Fun fact: A bolt of lightning is five times hotter than the surface of the Sun! ⚡",
  "What do you call a dinosaur that's great at maths? A tri-sara-tops! 🦕",
  "Fun fact: Octopuses have three hearts and blue blood! 🐙",
  "Why did the student eat his homework? The teacher said it was a piece of cake! 🍰",
  "Fun fact: A day on Venus is longer than a whole year on Venus! 🪐",
  "What's a snake's favourite school subject? Hiss-tory! 🐍",
  "Fun fact: Bananas are berries, but strawberries aren't! 🍌",
];

export function Loading() {
  const [pct, setPct] = useState(8);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUIPS.length));

  useEffect(() => {
    // Creep toward 92% so it always feels alive; the screen swaps to results when done.
    const grow = setInterval(() => {
      setPct((p) => (p < 92 ? p + Math.max(1, Math.round((92 - p) / 8)) : p));
    }, 500);
    const rotate = setInterval(() => setIdx((i) => (i + 1) % QUIPS.length), 4000);
    return () => { clearInterval(grow); clearInterval(rotate); };
  }, []);

  return (
    <div className="screen loading">
      <h2>Reading your homework… ✏️</h2>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Working on it"
      >
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="quip">{QUIPS[idx]}</p>
      <p className="subtitle">Hang tight — this can take a few seconds.</p>
    </div>
  );
}
