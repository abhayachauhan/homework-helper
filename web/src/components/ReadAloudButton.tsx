import { speak, speechSupported } from "../speech.js";

export function ReadAloudButton({ text }: { text: string }) {
  if (!speechSupported()) return null;
  return (
    <button className="read" type="button" onClick={() => speak(text)}>
      🔊 Read it to me
    </button>
  );
}
