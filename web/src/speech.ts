export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis;
}

export function speak(text: string): void {
  if (!speechSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
}
