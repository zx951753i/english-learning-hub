import { describe, expect, it } from "vitest";
import { emptyStats, MISTAKE_CLEAR_STREAK, nextStats } from "@/features/games/scoring";
import {
  assignmentStatus,
  bestStarsSince,
  formatDue,
  groupMistakes,
  parseGroupKey,
  taipeiDate,
  taipeiDay,
  todayMission,
} from "@/features/missions/rules";

describe("台灣時間的今天", () => {
  it("UTC 16:00 已經是台灣隔天 00:00", () => {
    const { start, end } = taipeiDay(new Date("2026-11-07T16:30:00Z"));
    expect(start.toISOString()).toBe("2026-11-07T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-08T16:00:00.000Z");
    expect(taipeiDate(new Date("2026-11-07T16:30:00Z"))).toBe("2026-11-08");
  });
  it("UTC 15:59 仍是台灣當天", () => {
    expect(taipeiDate(new Date("2026-11-07T15:59:00Z"))).toBe("2026-11-07");
    expect(taipeiDay(new Date("2026-11-07T15:59:00Z")).start.toISOString()).toBe("2026-11-06T16:00:00.000Z");
  });
});

describe("今日任務", () => {
  const base = { levelDoneToday: false, reviewDoneToday: false, openMistakes: 0, hasLevels: true };
  it("沒有錯題時只有闖一關", () => {
    expect(todayMission(base)).toEqual({ tasks: [{ key: "level", label: "完成一個關卡", done: false }], complete: false });
    expect(todayMission({ ...base, levelDoneToday: true })?.complete).toBe(true);
  });
  it("有錯題時要闖關並複習", () => {
    const mission = todayMission({ ...base, openMistakes: 3, levelDoneToday: true });
    expect(mission?.tasks.map((task) => [task.key, task.done])).toEqual([["level", true], ["review", false]]);
    expect(mission?.complete).toBe(false);
    expect(todayMission({ ...base, openMistakes: 3, levelDoneToday: true, reviewDoneToday: true })?.complete).toBe(true);
  });
  it("今天複習完清空錯題本，複習項目仍顯示為完成", () => {
    const mission = todayMission({ ...base, levelDoneToday: true, reviewDoneToday: true });
    expect(mission?.tasks.map((task) => task.key)).toEqual(["level", "review"]);
    expect(mission?.complete).toBe(true);
  });
  it("沒有關卡時只排錯題複習；什麼都沒有時沒有任務", () => {
    expect(todayMission({ ...base, hasLevels: false, openMistakes: 2 })?.tasks.map((t) => t.key)).toEqual(["review"]);
    expect(todayMission({ ...base, hasLevels: false })).toBeNull();
  });
});

describe("錯題本規則", () => {
  it(`答錯進入錯題本，之後連續答對 ${MISTAKE_CLEAR_STREAK} 次才移出`, () => {
    const now = new Date("2026-11-07T00:00:00Z");
    const wrong = nextStats(emptyStats, false, now);
    expect(wrong.is_open_mistake).toBe(true);
    const once = nextStats(wrong, true, now);
    expect(once.is_open_mistake).toBe(true);
    const twice = nextStats(once, true, now);
    expect(twice.is_open_mistake).toBe(false);
  });
  it("中間又答錯，重新計算", () => {
    const now = new Date();
    let stats = nextStats(emptyStats, false, now);
    stats = nextStats(stats, true, now);
    stats = nextStats(stats, false, now);
    stats = nextStats(stats, true, now);
    expect(stats.is_open_mistake).toBe(true);
  });
  it("從沒答錯的題目，答對也不會進錯題本", () => {
    expect(nextStats(emptyStats, true, new Date()).is_open_mistake).toBe(false);
  });
});

describe("錯題分組", () => {
  const book = "20000000-0000-4000-8000-00000000000a";
  const other = "20000000-0000-4000-8000-00000000000b";
  it("依遊戲與教材分組，題數多的在前，同題不重複", () => {
    const groups = groupMistakes([
      { question_id: "q1", game_type: "listen_and_choose", textbook_id: book },
      { question_id: "q2", game_type: "word_spelling", textbook_id: book },
      { question_id: "q3", game_type: "word_spelling", textbook_id: book },
      { question_id: "q3", game_type: "word_spelling", textbook_id: book },
      { question_id: "q4", game_type: "word_spelling", textbook_id: other },
    ]);
    expect(groups.map((group) => [group.game_type, group.textbook_id, group.questionIds])).toEqual([
      ["word_spelling", book, ["q2", "q3"]],
      ["listen_and_choose", book, ["q1"]],
      ["word_spelling", other, ["q4"]],
    ]);
    expect(parseGroupKey(groups[0].key)).toEqual({ game_type: "word_spelling", textbook_id: book });
  });
  it("拒絕格式不對的分組代碼", () => {
    expect(parseGroupKey("word_spelling:not-a-uuid")).toBeNull();
    expect(parseGroupKey("drop table;:" + book)).toBeNull();
  });
});

describe("指派任務完成判斷", () => {
  const assignment = { created_at: "2026-11-07T02:00:00Z", due_on: "2026-11-10" };
  const now = new Date("2026-11-08T02:00:00Z");
  it("指派後拿到 2 顆星才算完成", () => {
    expect(assignmentStatus(assignment, [{ completed_at: "2026-11-07T03:00:00Z", stars_earned: 1 }], now)).toBe("open");
    expect(assignmentStatus(assignment, [{ completed_at: "2026-11-07T03:00:00Z", stars_earned: 2 }], now)).toBe("done");
  });
  it("指派之前的成績不算", () => {
    expect(assignmentStatus(assignment, [{ completed_at: "2026-11-06T03:00:00Z", stars_earned: 3 }], now)).toBe("open");
  });
  it("期限當天（台灣時間）結束後才算逾期", () => {
    expect(assignmentStatus(assignment, [], new Date("2026-11-10T15:59:00Z"))).toBe("open");
    expect(assignmentStatus(assignment, [], new Date("2026-11-10T16:00:00Z"))).toBe("overdue");
    expect(assignmentStatus({ ...assignment, due_on: null }, [], new Date("2030-01-01T00:00:00Z"))).toBe("open");
  });
  it("逾期後完成仍算完成", () => {
    expect(
      assignmentStatus(assignment, [{ completed_at: "2026-11-12T00:00:00Z", stars_earned: 3 }], new Date("2026-11-13T00:00:00Z")),
    ).toBe("done");
  });
  it("指派後最好的星數", () => {
    expect(bestStarsSince(assignment.created_at, [])).toBeNull();
    expect(
      bestStarsSince(assignment.created_at, [
        { completed_at: "2026-11-06T00:00:00Z", stars_earned: 3 },
        { completed_at: "2026-11-07T05:00:00Z", stars_earned: 1 },
        { completed_at: null, stars_earned: null },
      ]),
    ).toBe(1);
  });
  it("期限顯示含星期", () => {
    expect(formatDue("2026-11-20")).toBe("11/20（五）");
  });
});

describe("學習紀錄的文字", () => {
  it("題目標籤", async () => {
    const { questionLabel } = await import("@/features/records/labels");
    expect(questionLabel("vocab_item", { word: "cat", meaning_zh: "貓" })).toBe("cat｜貓");
    expect(questionLabel("phonics_item", { letter: "a", sound: "/æ/" })).toBe("a /æ/");
    expect(questionLabel("unknown", { x: 1, y: "hello" })).toBe("hello");
  });
  it("選擇題顯示選項內容，拼字顯示輸入", async () => {
    const { answerLabel } = await import("@/features/records/labels");
    const choice = { renderer: "single_choice" as const, prompt: "", options: [{ id: "o1", label: "貓" }, { id: "o2", label: "狗" }] };
    expect(answerLabel(choice, "o2")).toBe("狗");
    expect(answerLabel({ renderer: "text_input", prompt: "", length: 3 }, "kat")).toBe("kat");
  });
});
