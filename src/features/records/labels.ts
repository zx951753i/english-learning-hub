import type { PublicRound } from "@/features/games/types";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** 老師畫面上辨識一題的簡短文字，例如「cat｜貓」「a /æ/」。 */
export function questionLabel(contentType: string, content: Record<string, unknown>) {
  switch (contentType) {
    case "vocab_item":
      return [text(content.word), text(content.meaning_zh)].filter(Boolean).join("｜");
    case "phonics_item":
      return [text(content.letter), text(content.sound)].filter(Boolean).join(" ");
    case "sentence_item":
      return text(content.sentence_en);
    case "choice_item":
      return text(content.stem);
    case "error_item":
      return text(content.sentence);
    case "sorting_item":
      return text(content.prompt);
    case "cloze_item":
      return text(content.text);
    default:
      return Object.values(content).map(text).find(Boolean) ?? "";
  }
}

/** 學生的作答轉成看得懂的文字：選擇題顯示選項內容，其他顯示輸入內容。 */
export function answerLabel(round: PublicRound, selected: unknown) {
  const raw = typeof selected === "string" ? selected : JSON.stringify(selected ?? "");
  if (round.renderer === "single_choice") {
    return round.options.find((option) => option.id === raw)?.label ?? raw;
  }
  return raw;
}
