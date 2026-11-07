import { shuffle } from "@/features/games/shuffle";
import type { GameDefinition, QuestionRow } from "@/features/games/types";

const chunks = (question: QuestionRow) =>
  (Array.isArray(question.content.chunks) ? question.content.chunks : [])
    .map((item) => String(item).trim())
    .filter(Boolean);
const answer = (question: QuestionRow) => String(question.answer_key.answer ?? "").trim();
const alternatives = (question: QuestionRow) =>
  (Array.isArray(question.answer_key.alternatives) ? question.answer_key.alternatives : []).map(String);

/** 比對句子時忽略多餘空白；大小寫與標點以詞塊為準。 */
export const normalizeSentence = (value: string) => value.replace(/\s+/g, " ").trim();

/** 打亂詞塊；詞塊兩個以上時，保證順序和正確答案不同。 */
function scramble(items: string[], random: () => number) {
  if (new Set(items).size < 2) return items;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const mixed = shuffle(items, random);
    if (mixed.join("\u0000") !== items.join("\u0000")) return mixed;
  }
  return [...items.slice(1), items[0]];
}

/** 把詞塊排成正確的句子；學生送出排好的整句，伺服器比對答案與其他可接受答案。 */
export const sentenceBuilder: GameDefinition = {
  key: "sentence_builder",
  label: "Sentence Builder",
  description: "把詞塊排成正確的英文句子",
  renderer: "order_chunks",
  contentTypes: ["sentence_item"],
  stages: ["kids"],
  minQuestions: 2,
  identity: (question) => normalizeSentence(answer(question)).toLowerCase(),
  accepts: (question) => chunks(question).length >= 2 && Boolean(answer(question)),
  buildRounds(questions, _pool, random) {
    return questions.map((question) => {
      const instruction = String(question.content.instruction ?? "").trim();
      const mixed = scramble(chunks(question), random);
      const correct = normalizeSentence(chunks(question).join(" "));
      return {
        publicRound: {
          renderer: "order_chunks" as const,
          prompt: String(question.content.sentence_zh ?? ""),
          instruction: instruction || undefined,
          chunks: mixed.map((label, index) => ({ id: `c${index + 1}`, label })),
        },
        gradingKey: {
          answer: correct,
          accepted: [normalizeSentence(answer(question)), ...alternatives(question).map(normalizeSentence)],
          display: normalizeSentence(answer(question)),
          speakAfter: normalizeSentence(answer(question)),
        },
      };
    });
  },
  grade: (response, key) => {
    const given = normalizeSentence(response);
    return given === key.answer || (key.accepted ?? []).includes(given);
  },
};
