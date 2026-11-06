/**
 * 使用瀏覽器內建語音。iPhone Safari 只允許在點擊當下播放，
 * 也會在 cancel() 後立刻 speak() 時吞掉語音，所以只在播放中才取消。
 */
export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function englishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === "en-US") ?? voices.find((voice) => voice.lang.startsWith("en"));
}

export function speakEnglish(text: string) {
  if (!canSpeak() || !text) return false;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  const voice = englishVoice();
  if (voice) utterance.voice = voice;
  synth.resume();
  synth.speak(utterance);
  return true;
}
