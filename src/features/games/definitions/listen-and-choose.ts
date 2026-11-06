import { shuffle } from "@/features/games/shuffle";
import type { GameDefinition, QuestionRow } from "@/features/games/types";

const word = (question: QuestionRow) => String(question.content.word ?? "").trim();
const meaning = (question: QuestionRow) => String(question.content.meaning_zh ?? "").trim();
const image = (question: QuestionRow) => String(question.content.image ?? "").trim();

const OPTION_COUNT = 4;

export const listenAndChoose: GameDefinition = {
  key: "listen_and_choose",
  label: "Listen and Choose",
  description: "聽單字，選出正確的圖片或中文",
  renderer: "single_choice",
  contentTypes: ["vocab_item"],
  stages: ["kids"],
  minQuestions: 2,
  identity: (question) => word(question).toLowerCase(),
  accepts: (question) => Boolean(word(question)),
  buildRounds(questions, pool, random) {
    return questions.map((question) => {
      const others = shuffle(
        pool.filter((item) => word(item).toLowerCase() !== word(question).toLowerCase()),
        random,
      ).slice(0, OPTION_COUNT - 1);
      const choices = shuffle([question, ...others], random);
      const options = choices.map((item, index) => ({
        id: `o${index + 1}`,
        label: meaning(item),
        image: image(item) || undefined,
      }));
      const correct = options[choices.indexOf(question)];
      return {
        publicRound: {
          renderer: "single_choice" as const,
          prompt: "聽聽看，選出正確答案",
          speak: word(question),
          options,
        },
        gradingKey: { answer: correct.id, display: `${word(question)}｜${meaning(question)}` },
      };
    });
  },
  grade: (response, key) => response === key.answer,
};
