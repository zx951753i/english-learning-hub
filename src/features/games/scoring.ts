export const scoreFor = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

const DAY = 24 * 60 * 60 * 1000;
/** 連續答對 1、2、3 次後的複習間隔（天）。 */
const REVIEW_DAYS = [3, 7, 14];

export type QuestionStats = {
  attempt_count: number;
  correct_count: number;
  wrong_count: number;
  consecutive_correct: number;
  is_open_mistake: boolean;
};

export const emptyStats: QuestionStats = {
  attempt_count: 0,
  correct_count: 0,
  wrong_count: 0,
  consecutive_correct: 0,
  is_open_mistake: false,
};

/** 答錯隔 1 天複習；連續答對 3 次後移出錯題。 */
export function nextStats(previous: QuestionStats, isCorrect: boolean, now: Date) {
  const consecutive = isCorrect ? previous.consecutive_correct + 1 : 0;
  const hadMistake = previous.is_open_mistake;
  const isOpen = isCorrect ? hadMistake && consecutive < 3 : true;
  const days = isCorrect ? REVIEW_DAYS[Math.min(consecutive, 3) - 1] : 1;
  return {
    attempt_count: previous.attempt_count + 1,
    correct_count: previous.correct_count + (isCorrect ? 1 : 0),
    wrong_count: previous.wrong_count + (isCorrect ? 0 : 1),
    consecutive_correct: consecutive,
    is_open_mistake: isOpen,
    last_answered_at: now.toISOString(),
    next_review_at: new Date(now.getTime() + days * DAY).toISOString(),
  };
}
