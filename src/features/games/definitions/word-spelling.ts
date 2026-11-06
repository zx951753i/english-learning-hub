import type { GameDefinition, QuestionRow } from "@/features/games/types";

const word = (question: QuestionRow) => String(question.content.word ?? "").trim();

export const normalizeSpelling = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export const wordSpelling: GameDefinition = {
  key: "word_spelling",
  label: "Word Spelling",
  description: "看圖或中文，聽發音後拼出單字",
  renderer: "text_input",
  contentTypes: ["vocab_item"],
  stages: ["kids"],
  minQuestions: 2,
  identity: (question) => word(question).toLowerCase(),
  accepts: (question) => Boolean(word(question)),
  buildRounds: (questions) =>
    questions.map((question) => ({
      publicRound: {
        renderer: "text_input" as const,
        prompt: String(question.content.meaning_zh ?? ""),
        speak: word(question),
        image: String(question.content.image ?? "") || undefined,
        length: word(question).length,
      },
      gradingKey: { answer: normalizeSpelling(word(question)), display: word(question) },
    })),
  grade: (response, key) => normalizeSpelling(response) === key.answer,
};
