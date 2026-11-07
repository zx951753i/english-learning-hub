import { shuffle } from "@/features/games/shuffle";
import type { GameDefinition, QuestionRow } from "@/features/games/types";

const word = (question: QuestionRow) => String(question.content.word ?? "").trim();
const meaning = (question: QuestionRow) => String(question.content.meaning_zh ?? "").trim();
const image = (question: QuestionRow) => String(question.content.image ?? "").trim();

const OPTION_COUNT = 4;

/** 看圖片選出英文單字；只使用有圖片的單字題，干擾選項可用沒有圖片的單字。 */
export const pictureVocabulary: GameDefinition = {
  key: "picture_vocabulary",
  label: "Picture Vocabulary",
  description: "看圖片，選出正確的英文單字",
  renderer: "single_choice",
  contentTypes: ["vocab_item"],
  stages: ["kids"],
  minQuestions: 2,
  identity: (question) => word(question).toLowerCase(),
  accepts: (question) => Boolean(word(question) && image(question)),
  buildRounds(questions, pool, random) {
    return questions.map((question) => {
      const target = word(question).toLowerCase();
      const others = shuffle(
        pool.filter((item) => word(item) && word(item).toLowerCase() !== target),
        random,
      ).slice(0, OPTION_COUNT - 1);
      const choices = shuffle([question, ...others], random);
      const options = choices.map((item, index) => ({ id: `o${index + 1}`, label: word(item) }));
      const correct = options[choices.indexOf(question)];
      return {
        publicRound: {
          renderer: "single_choice" as const,
          prompt: "看圖片，選出正確的單字",
          image: image(question),
          options,
        },
        gradingKey: { answer: correct.id, display: `${word(question)}｜${meaning(question)}` },
      };
    });
  },
  grade: (response, key) => response === key.answer,
};
