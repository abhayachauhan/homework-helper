import { useEffect, useState } from "react";

const QUIPS: string[] = [
  // Jokes
  "Why did the maths book look so sad? Because it had too many problems! 📖",
  "Why was 6 scared of 7? Because 7 8 9! 😅",
  "What do you call a dinosaur that's great at maths? A tri-sara-tops! 🦕",
  "Why did the student eat his homework? The teacher said it was a piece of cake! 🍰",
  "What's a snake's favourite school subject? Hiss-tory! 🐍",
  "Why can't you trust an atom? Because they make up everything! ⚛️",
  "What did the zero say to the eight? Nice belt! 🔢",
  "Why did the maths teacher open the window? To let some fresh 'sums' in! 🪟",
  "What's brown and sticky? A stick! 🪵",
  "Why was the equals sign so humble? It knew it wasn't greater or less than anyone! ➗",
  "What do you call cheese that isn't yours? Nacho cheese! 🧀",
  "Why did the book join the police? It wanted to go undercover! 📚",
  "What do you call a fish wearing a bowtie? So-fish-ticated! 🐟",
  "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
  "What do you call a bear with no teeth? A gummy bear! 🐻",
  "Why don't scientists trust stairs? Because they're always up to something! 🪜",
  "What's orange and sounds like a parrot? A carrot! 🥕",
  "How do you make the number seven even? Take away the 's'! ✂️",
  "What did one wall say to the other wall? I'll meet you at the corner! 🧱",
  "Why did the teacher wear sunglasses? Because her students were so bright! 😎",
  "What kind of tree fits in your hand? A palm tree! 🌴",
  "Why was the maths lesson so long? The teacher kept going off on a tangent! 📐",
  "What do you call a sleeping dinosaur? A dino-snore! 😴",
  "Why did the pencil get an award? It was the sharpest in the class! ✏️",
  "What's a maths teacher's favourite dessert? Pi! 🥧",
  // Fun facts
  "Fun fact: Honey never goes off — people have eaten 3,000-year-old honey! 🍯",
  "Fun fact: A bolt of lightning is five times hotter than the surface of the Sun! ⚡",
  "Fun fact: Octopuses have three hearts and blue blood! 🐙",
  "Fun fact: A day on Venus is longer than a whole year on Venus! 🪐",
  "Fun fact: Bananas are berries, but strawberries aren't! 🍌",
  "Fun fact: A group of flamingos is called a 'flamboyance'! 🦩",
  "Fun fact: Sharks have been around longer than trees! 🦈",
  "Fun fact: Wombat poop is shaped like little cubes! 🟫",
  "Fun fact: The Eiffel Tower can grow over 15cm taller on a hot day! 🗼",
  "Fun fact: A tiny snail can sleep for up to three years! 🐌",
  "Fun fact: Your nose can remember about 50,000 different smells! 👃",
  "Fun fact: Cows have best friends and get stressed when they're apart! 🐄",
  "Fun fact: There are more stars in the sky than grains of sand on every beach! ✨",
  "Fun fact: A hummingbird's heart can beat over 1,200 times a minute! 🐦",
  "Fun fact: Sloths can hold their breath longer than dolphins can! 🦥",
  "Fun fact: Some turtles can breathe through their bottoms! 🐢",
  "Fun fact: A big cloud can weigh more than a million kilograms! ☁️",
  "Fun fact: Honeybees can recognise human faces! 🐝",
  "Fun fact: The shortest war in history lasted under 45 minutes! ⏱️",
  "Fun fact: An octopus can squeeze through a gap the size of its eyeball! 🐙",
  "Fun fact: Bubble wrap was first invented to be wallpaper! 🫧",
  "Fun fact: Penguins give each other pebbles as gifts! 🐧",
  "Fun fact: The dot over a lower-case 'i' is called a 'tittle'! 🔤",
  "Fun fact: Saturn is so light it would float in water — with a big enough bath! 🪐",
  "Fun fact: A jiffy is a real unit of time — about one trillionth of a second! ⏳",
];

export function Loading() {
  const [pct, setPct] = useState(8);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUIPS.length));

  useEffect(() => {
    // Creep toward 92% so it always feels alive; the screen swaps to results when done.
    const grow = setInterval(() => {
      setPct((p) => (p < 92 ? p + Math.max(1, Math.round((92 - p) / 8)) : p));
    }, 500);
    const rotate = setInterval(() => setIdx((i) => (i + 1) % QUIPS.length), 10000);
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
