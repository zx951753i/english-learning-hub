/** 任務與錯題本的純函式：伺服器與測試共用。 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** 台灣不實施日光節約時間，固定 UTC+8。 */
const TAIPEI_OFFSET = 8 * HOUR;

/** 每局錯題複習最多幾題。 */
export const REVIEW_SIZE = 10;
/** 指派任務需要的星數。 */
export const ASSIGNMENT_STARS = 2;

/** 台灣時間的「今天」：回傳 UTC 的開始與結束時間。 */
export function taipeiDay(now: Date) {
  const local = now.getTime() + TAIPEI_OFFSET;
  const start = Math.floor(local / DAY) * DAY - TAIPEI_OFFSET;
  return { start: new Date(start), end: new Date(start + DAY) };
}

/** 台灣時間的日期字串 YYYY-MM-DD。 */
export function taipeiDate(now: Date) {
  return new Date(now.getTime() + TAIPEI_OFFSET).toISOString().slice(0, 10);
}

export type MissionInput = {
  /** 今天是否完成過任何關卡（一般或再挑戰） */
  levelDoneToday: boolean;
  /** 今天是否完成過錯題複習 */
  reviewDoneToday: boolean;
  /** 目前還在錯題本的題數 */
  openMistakes: number;
  /** 是否有可以玩的關卡 */
  hasLevels: boolean;
};

export type MissionTask = { key: "level" | "review"; label: string; done: boolean };
export type Mission = { tasks: MissionTask[]; complete: boolean };

/**
 * 今日任務（全自動）：闖一關；錯題本有題目時再加一項錯題複習。
 * 今天已經複習過，就算錯題本清空了，這項也保留並顯示為完成。
 */
export function todayMission(input: MissionInput): Mission | null {
  const tasks: MissionTask[] = [];
  if (input.hasLevels || input.levelDoneToday) {
    tasks.push({ key: "level", label: "完成一個關卡", done: input.levelDoneToday });
  }
  if (input.openMistakes > 0 || input.reviewDoneToday) {
    tasks.push({ key: "review", label: "複習錯題本", done: input.reviewDoneToday });
  }
  if (tasks.length === 0) return null;
  return { tasks, complete: tasks.every((task) => task.done) };
}

export type MistakeRow = { question_id: string; game_type: string; textbook_id: string };
export type MistakeGroup = { key: string; game_type: string; textbook_id: string; questionIds: string[] };

/** 依「上次答錯時的遊戲」與教材分組，題數多的在前。 */
export function groupMistakes(rows: MistakeRow[]): MistakeGroup[] {
  const groups = new Map<string, MistakeGroup>();
  for (const row of rows) {
    const key = `${row.game_type}:${row.textbook_id}`;
    const group = groups.get(key) ?? { key, game_type: row.game_type, textbook_id: row.textbook_id, questionIds: [] };
    if (!group.questionIds.includes(row.question_id)) group.questionIds.push(row.question_id);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.questionIds.length - a.questionIds.length || a.key.localeCompare(b.key));
}

export const parseGroupKey = (key: string) => {
  const match = /^([a-z_]+):([0-9a-f-]{36})$/i.exec(key);
  return match ? { game_type: match[1], textbook_id: match[2] } : null;
};

export type AssignmentStatus = "done" | "open" | "overdue";
export type AttemptRow = { completed_at: string | null; stars_earned: number | null };

/** 指派之後拿到至少 2 顆星才算完成；期限當天（台灣時間）結束前都算準時。 */
export function assignmentStatus(
  assignment: { created_at: string; due_on: string | null },
  attempts: AttemptRow[],
  now: Date,
): AssignmentStatus {
  const since = new Date(assignment.created_at).getTime();
  const done = attempts.some(
    (attempt) =>
      attempt.completed_at !== null &&
      new Date(attempt.completed_at).getTime() >= since &&
      (attempt.stars_earned ?? 0) >= ASSIGNMENT_STARS,
  );
  if (done) return "done";
  if (assignment.due_on && taipeiDate(now) > assignment.due_on) return "overdue";
  return "open";
}

/** 指派之後最好的星數（尚未作答為 null）。 */
export function bestStarsSince(createdAt: string, attempts: AttemptRow[]) {
  const since = new Date(createdAt).getTime();
  const stars = attempts
    .filter((attempt) => attempt.completed_at !== null && new Date(attempt.completed_at).getTime() >= since)
    .map((attempt) => attempt.stars_earned ?? 0);
  return stars.length ? Math.max(...stars) : null;
}

/** 期限顯示，例如「11/20（五）」。 */
export function formatDue(dueOn: string) {
  const [year, month, day] = dueOn.split("-").map(Number);
  const weekday = "日一二三四五六"[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}/${day}（${weekday}）`;
}
