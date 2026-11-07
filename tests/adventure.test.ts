import { describe, expect, it } from "vitest";
import {
  adventureLevel,
  computeLevelStates,
  levelTitle,
  starsFor,
  ZONE_TEMPLATES,
  type LevelInput,
} from "@/features/adventure/rules";

const levels = (rules: LevelInput["unlock_rule"][]): LevelInput[] =>
  rules.map((unlock_rule, index) => ({ id: `L${index + 1}`, order_index: (index + 1) * 10, unlock_rule }));

describe("星星門檻", () => {
  it.each([
    [0, 1], [59, 1], [60, 2], [89, 2], [90, 3], [100, 3],
  ])("%i 分得 %i 顆星", (score, stars) => {
    expect(starsFor(score)).toBe(stars);
  });

  it("老師可調整門檻", () => {
    expect(starsFor(70, 75, 95)).toBe(1);
    expect(starsFor(80, 75, 95)).toBe(2);
  });
});

describe("解鎖", () => {
  it("新學生只有第一關開放，且標為下一關", () => {
    const states = computeLevelStates(levels(["previous_complete", "previous_complete", "previous_complete"]), new Map());
    expect(states.map((s) => s.status)).toEqual(["current", "locked", "locked"]);
    expect(states[1].hint).toBe("先完成上一關");
  });

  it("完成上一關即解鎖下一關", () => {
    const states = computeLevelStates(levels(["previous_complete", "previous_complete", "previous_complete"]), new Map([["L1", 1]]));
    expect(states.map((s) => s.status)).toEqual(["done", "current", "locked"]);
  });

  it("需要 2 顆星的關卡，上一關只有 1 顆星時仍鎖定", () => {
    const rules = levels(["previous_complete", "previous_two_stars"]);
    expect(computeLevelStates(rules, new Map([["L1", 1]]))[1]).toMatchObject({
      status: "locked",
      hint: "先在上一關拿到 2 顆星",
    });
    expect(computeLevelStates(rules, new Map([["L1", 2]]))[1].status).toBe("current");
  });

  it("一律開放的關卡不受前一關影響，但只有第一個未完成的是下一關", () => {
    const states = computeLevelStates(levels(["previous_complete", "always_open", "always_open"]), new Map());
    expect(states.map((s) => s.status)).toEqual(["current", "open", "open"]);
  });

  it("依 order_index 排序，不依傳入順序", () => {
    const input = levels(["previous_complete", "previous_complete"]).reverse();
    expect(computeLevelStates(input, new Map()).map((s) => s.id)).toEqual(["L1", "L2"]);
  });

  it("後面的關卡已完成時，仍保留星星顯示", () => {
    const states = computeLevelStates(levels(["previous_complete", "previous_complete"]), new Map([["L2", 3]]));
    expect(states[1]).toMatchObject({ status: "done", stars: 3 });
  });
});

describe("冒險等級", () => {
  it.each([
    [0, 1, 10], [9, 1, 1], [10, 2, 10], [23, 3, 7],
  ])("%i 顆星為 Lv.%i，距下一級 %i 顆", (stars, level, toNext) => {
    expect(adventureLevel(stars)).toMatchObject({ level, toNext });
  });

  it("等級稱號", () => {
    expect(levelTitle(1)).toBe("小小探險家");
    expect(levelTitle(4)).toBe("勇敢探險家");
    expect(levelTitle(99)).toBe("傳奇探險家");
  });
});

describe("區域範本", () => {
  it("三座島都有範本，國小島有 Final Boss", () => {
    expect(Object.keys(ZONE_TEMPLATES)).toEqual(["kids", "junior", "senior"]);
    expect(ZONE_TEMPLATES.kids.at(-1)).toEqual({ name: "Final Boss Challenge", theme: "boss" });
  });
});

describe("指派的關卡", () => {
  it("老師指派的關卡不受解鎖條件限制", () => {
    const levels = [
      { id: "a", order_index: 1, unlock_rule: "previous_complete" as const },
      { id: "b", order_index: 2, unlock_rule: "previous_complete" as const },
      { id: "c", order_index: 3, unlock_rule: "previous_two_stars" as const },
    ];
    const states = computeLevelStates(levels, new Map(), new Set(["c"]));
    expect(states.map((state) => state.status)).toEqual(["current", "locked", "open"]);
  });
});
