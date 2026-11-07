import { describe, expect, it } from "vitest";
import { alphabetMatching } from "@/features/games/definitions/alphabet-matching";
import { listenAndChoose } from "@/features/games/definitions/listen-and-choose";
import { wordSpelling } from "@/features/games/definitions/word-spelling";
import { GAME_DEFINITIONS, getGameDefinition } from "@/features/games/registry";
import { emptyStats, nextStats, scoreFor } from "@/features/games/scoring";
import type { QuestionRow } from "@/features/games/types";
import { detectImage, normalizeFileName } from "@/features/media/rules";

const vocab = (word: string, meaning: string, image = ""): QuestionRow => ({
  id: word,
  topic_id: null,
  content_type: "vocab_item",
  content: { word, meaning_zh: meaning, image },
  answer_key: { answer: word },
  explanation_zh: null,
});
const phonics = (letter: string): QuestionRow => ({
  id: letter,
  topic_id: null,
  content_type: "phonics_item",
  content: { letter, sound: "/x/", example_words: [] },
  answer_key: {},
  explanation_zh: null,
});
const seeded = () => {
  let seed = 7;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};
const pool = [vocab("cat", "貓", "cat.png"), vocab("dog", "狗", "dog.png"), vocab("hat", "帽子"), vocab("bag", "包包"), vocab("pen", "筆")];

describe("遊戲註冊", () => {
  it("三款遊戲都已註冊", () => {
    expect(GAME_DEFINITIONS.map((game) => game.key)).toEqual([
      "alphabet_matching",
      "listen_and_choose",
      "word_spelling",
    ]);
    expect(getGameDefinition("nope")).toBeUndefined();
  });
});

describe("Alphabet Matching", () => {
  const rounds = alphabetMatching.buildRounds([phonics("A"), phonics("b"), phonics("c")], [], seeded());

  it("左邊大寫、右邊小寫，且右欄包含全部答案", () => {
    expect(rounds.map((round) => round.publicRound.renderer === "match_pairs" && round.publicRound.left)).toEqual(["A", "B", "C"]);
    const first = rounds[0].publicRound;
    expect(first.renderer === "match_pairs" && [...first.rights].sort()).toEqual(["a", "b", "c"]);
  });

  it("只接受單一英文字母", () => {
    expect(alphabetMatching.accepts(phonics("a"))).toBe(true);
    expect(alphabetMatching.accepts(phonics("sh"))).toBe(false);
  });

  it("配對批改", () => {
    expect(alphabetMatching.grade("a", rounds[0].gradingKey)).toBe(true);
    expect(alphabetMatching.grade("b", rounds[0].gradingKey)).toBe(false);
  });
});

describe("Listen and Choose", () => {
  const rounds = listenAndChoose.buildRounds([pool[0], pool[1]], pool, seeded());

  it("每題 4 個不重複選項，保留圖片", () => {
    const round = rounds[0].publicRound;
    if (round.renderer !== "single_choice") throw new Error("renderer");
    expect(round.options).toHaveLength(4);
    expect(new Set(round.options.map((option) => option.label)).size).toBe(4);
    expect(round.options.some((option) => option.image === "cat.png")).toBe(true);
  });

  it("送到瀏覽器的選項看不出哪個正確", () => {
    const text = JSON.stringify(rounds[0].publicRound);
    expect(text).not.toContain(rounds[0].gradingKey.display);
    expect(text).not.toContain("correct");
    expect(text).not.toContain("answer");
  });

  it("批改只接受正確選項", () => {
    const { publicRound, gradingKey } = rounds[0];
    if (publicRound.renderer !== "single_choice") throw new Error("renderer");
    const wrong = publicRound.options.find((option) => option.id !== gradingKey.answer)!;
    expect(listenAndChoose.grade(gradingKey.answer, gradingKey)).toBe(true);
    expect(listenAndChoose.grade(wrong.id, gradingKey)).toBe(false);
  });
});

describe("Word Spelling", () => {
  const [round] = wordSpelling.buildRounds([vocab("Ice Cream", "冰淇淋", "ice.png")], [], seeded());

  it("提供中文、圖片與字數", () => {
    expect(round.publicRound).toMatchObject({ prompt: "冰淇淋", image: "ice.png", length: 9 });
  });

  it.each(["ice cream", " ICE  CREAM ", "Ice Cream"])("接受 %s", (value) => {
    expect(wordSpelling.grade(value, round.gradingKey)).toBe(true);
  });

  it("拼錯時判定錯誤", () => {
    expect(wordSpelling.grade("ice crem", round.gradingKey)).toBe(false);
  });
});

describe("計分與錯題", () => {
  it("分數四捨五入", () => {
    expect(scoreFor(2, 3)).toBe(67);
    expect(scoreFor(0, 0)).toBe(0);
  });

  const now = new Date("2026-11-07T00:00:00Z");
  const days = (iso: string) => (Date.parse(iso) - now.getTime()) / 86400000;

  it("答錯列入錯題，隔 1 天複習", () => {
    const stats = nextStats(emptyStats, false, now);
    expect(stats).toMatchObject({ is_open_mistake: true, wrong_count: 1, consecutive_correct: 0 });
    expect(days(stats.next_review_at)).toBe(1);
  });

  it("連續答對 2 次後移出錯題，複習間隔 3、7、14 天", () => {
    let stats = { ...nextStats(emptyStats, false, now) };
    const gaps: number[] = [];
    const open: boolean[] = [];
    for (let i = 0; i < 3; i += 1) {
      stats = nextStats(stats, true, now);
      gaps.push(days(stats.next_review_at));
      open.push(stats.is_open_mistake);
    }
    expect(gaps).toEqual([3, 7, 14]);
    expect(open).toEqual([true, false, false]);
  });

  it("答對從未錯過的題目不會變成錯題", () => {
    expect(nextStats(emptyStats, true, now).is_open_mistake).toBe(false);
  });
});

describe("媒體檔案", () => {
  it("依內容辨識圖片，拒絕偽裝的檔案", () => {
    expect(detectImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))?.mime).toBe("image/png");
    expect(detectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(detectImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("檔名統一小寫並移除路徑", () => {
    expect(normalizeFileName("C:\\Pics\\Apple.PNG")).toBe("apple.png");
    expect(normalizeFileName("../x/Cat.png")).toBe("cat.png");
  });
});
