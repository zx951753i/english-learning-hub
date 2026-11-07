import { baseLetter } from "@/features/games/letters";
import { shuffle } from "@/features/games/shuffle";
import type { GameDefinition, QuestionRow } from "@/features/games/types";

const letter = (question: QuestionRow) => String(question.content.letter ?? "").trim();
const sound = (question: QuestionRow) => String(question.content.sound ?? "").trim();
const words = (question: QuestionRow) =>
  (Array.isArray(question.content.example_words) ? question.content.example_words : [])
    .map((item) => String(item).trim())
    .filter(Boolean);
const audio = (question: QuestionRow) => String(question.content.audio ?? "").trim();

const OPTION_COUNT = 4;

/**
 * 聽例字，選出例字裡的字母或字母組合。
 * 干擾選項不可出現在例字中（例如 cat 不能拿 t 當干擾），避免有兩個正確答案。
 */
export const phonicsSoundMatch: GameDefinition = {
  key: "phonics_sound_match",
  label: "Phonics Sound Match",
  description: "聽例字的發音，選出對應的字母或字母組合",
  renderer: "single_choice",
  contentTypes: ["phonics_item"],
  stages: ["kids"],
  minQuestions: 2,
  identity: (question) => baseLetter(letter(question)),
  accepts: (question) => Boolean(letter(question) && words(question).length > 0),
  buildRounds(questions, pool, random) {
    return questions.map((question) => {
      // 「Ii」視同 i：比對重複與例字時都用正規化後的字母，選項仍顯示老師寫的樣子
      const target = baseLetter(letter(question));
      const example = shuffle(words(question), random)[0];
      const exampleLower = example.toLowerCase();
      const seen = new Set([target]);
      const others = shuffle(pool, random)
        .map((item) => letter(item))
        .filter((item) => {
          const base = baseLetter(item);
          if (!base || seen.has(base) || exampleLower.includes(base)) return false;
          seen.add(base);
          return true;
        })
        .slice(0, OPTION_COUNT - 1);
      const labels = shuffle([letter(question), ...others], random);
      const options = labels.map((label, index) => ({ id: `o${index + 1}`, label }));
      const correct = options[labels.indexOf(letter(question))];
      return {
        publicRound: {
          renderer: "single_choice" as const,
          prompt: "聽聽看，這個字有哪一個發音？",
          speak: example,
          audio: audio(question) || undefined,
          large: true,
          options,
        },
        gradingKey: { answer: correct.id, display: `${letter(question)} ${sound(question)}（${example}）` },
      };
    });
  },
  grade: (response, key) => response === key.answer,
};
