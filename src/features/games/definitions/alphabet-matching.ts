import { shuffle } from "@/features/games/shuffle";
import type { GameDefinition } from "@/features/games/types";

const letterOf = (content: Record<string, unknown>) => String(content.letter ?? "").trim();

export const alphabetMatching: GameDefinition = {
  key: "alphabet_matching",
  label: "Alphabet Matching",
  description: "大小寫字母配對",
  renderer: "match_pairs",
  contentTypes: ["phonics_item"],
  stages: ["kids"],
  minQuestions: 2,
  identity: (question) => letterOf(question.content).toLowerCase(),
  accepts: (question) => /^[a-z]$/i.test(letterOf(question.content)),
  buildRounds(questions, _pool, random) {
    const letters = questions.map((question) => letterOf(question.content).toLowerCase());
    const rights = shuffle(letters, random);
    return letters.map((letter) => ({
      publicRound: { renderer: "match_pairs" as const, left: letter.toUpperCase(), rights },
      gradingKey: { answer: letter, display: letter },
    }));
  },
  grade: (response, key) => response.trim() === key.answer,
};
