import { listenAndChoose } from "@/features/games/definitions/listen-and-choose";
import { phonicsSoundMatch } from "@/features/games/definitions/phonics-sound-match";
import { pictureVocabulary } from "@/features/games/definitions/picture-vocabulary";
import { sentenceBuilder } from "@/features/games/definitions/sentence-builder";
import { wordSpelling } from "@/features/games/definitions/word-spelling";
import type { BuiltRound, GameDefinition, QuestionRow } from "@/features/games/types";

/** 可以一題一題混在同一局的遊戲（Alphabet Matching 是整盤配對，不放進來）。 */
export const BOSS_GAMES: GameDefinition[] = [
  pictureVocabulary,
  listenAndChoose,
  wordSpelling,
  phonicsSoundMatch,
  sentenceBuilder,
];

const fits = (game: GameDefinition, question: QuestionRow) =>
  game.contentTypes.includes(question.content_type) && game.accepts(question);

const gamesFor = (question: QuestionRow) => BOSS_GAMES.filter((game) => fits(game, question));

/**
 * Final Boss Challenge：從單元的單字、自然發音、句子題抽題，
 * 每題輪流使用「目前用得最少」的合適遊戲，讓一局裡混合多種玩法。
 * 批改時依 gradingKey.game 交給那款遊戲。
 */
export const finalBoss: GameDefinition = {
  key: "final_boss",
  label: "Final Boss Challenge",
  description: "單元終極挑戰：混合看圖、聽音、拼字、發音與句子重組",
  renderer: "mixed",
  contentTypes: ["vocab_item", "phonics_item", "sentence_item"],
  stages: ["kids"],
  minQuestions: 3,
  identity: (question) => {
    const game = gamesFor(question)[0];
    return `${question.content_type}:${game ? game.identity(question) : question.id}`;
  },
  accepts: (question) => gamesFor(question).length > 0,
  buildRounds(questions, pool, random) {
    const used = new Map<string, number>();
    return questions.map((question): BuiltRound => {
      const options = gamesFor(question);
      const least = Math.min(...options.map((game) => used.get(game.key) ?? 0));
      const candidates = options.filter((game) => (used.get(game.key) ?? 0) === least);
      const game = candidates[Math.floor(random() * candidates.length)];
      used.set(game.key, least + 1);
      const [round] = game.buildRounds([question], pool.filter((item) => fits(game, item) || item.content_type === question.content_type), random);
      return { publicRound: round.publicRound, gradingKey: { ...round.gradingKey, game: game.key } };
    });
  },
  grade: (response, key) => {
    const game = BOSS_GAMES.find((item) => item.key === key.game);
    return game ? game.grade(response, key) : false;
  },
};
