import { describe, expect, it } from "vitest";
import { CONTENT_TYPES, getContentType } from "@/features/question-bank/content-types";
import { parseQuestionTable, templateHeaders, type ImportContext } from "@/features/question-bank/import";

const type = (key: string) => getContentType(key)!;

const context: ImportContext = {
  difficultyLabels: ["基礎", "中階", "進階", "學測挑戰"],
  units: [
    {
      id: "u1",
      title: "Unit 1",
      topics: [{ id: "t1", title: "Past Simple" }],
      passages: [{ id: "p1", title: "My Day" }],
    },
  ],
};

describe("七種內容類型", () => {
  const samples: Record<string, Record<string, string>> = {
    vocab_item: { word: "apple", meaning_zh: "蘋果", part_of_speech: "n.", example_sentence: "" },
    phonics_item: { letter: "a", sound: "/æ/", example_words: "cat, hat" },
    sentence_item: {
      sentence_en: "I like apples.",
      sentence_zh: "我喜歡蘋果。",
      chunks: "I / like / apples.",
      alternatives: "",
      instruction: "",
    },
    choice_item: {
      stem: "She ___ happy.",
      option_a: "is",
      option_b: "are",
      option_c: "",
      option_d: "",
      correct: "A",
    },
    cloze_item: { text: "I ___ to school ___ bus.", answers: "go / by" },
    sorting_item: {
      prompt: "分類",
      categories: "名詞 / 動詞",
      items: "apple = 名詞\nrun = 動詞",
    },
    error_item: { sentence: "She go to school.", error_text: "go", correction: "goes" },
  };

  it("涵蓋全部 7 種", () => {
    expect(CONTENT_TYPES).toHaveLength(7);
    expect(Object.keys(samples).sort()).toEqual(CONTENT_TYPES.map((item) => item.key).sort());
  });

  it.each(Object.keys(samples))("%s 存檔後再編輯，內容不會改變", (key) => {
    const built = type(key).build(samples[key]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const flat = type(key).flatten(built.content, built.answerKey);
    expect(type(key).build(flat)).toEqual(built);
  });

  it.each(Object.keys(samples))("%s 未填必填欄位時拒絕", (key) => {
    expect(type(key).build({}).ok).toBe(false);
  });

  it("找錯誤題的答案不放進題目內容", () => {
    const built = type("error_item").build(samples.error_item);
    expect(built.ok && JSON.stringify(built.content)).not.toContain("goes");
  });

  it("重組切分必須與句子相符", () => {
    expect(type("sentence_item").build({ ...samples.sentence_item, chunks: "You / like" }).ok).toBe(false);
  });

  it("重組切分留空時依空格切分", () => {
    const built = type("sentence_item").build({ ...samples.sentence_item, chunks: "" });
    expect(built.ok && built.content.chunks).toEqual(["I", "like", "apples."]);
  });

  it("選擇題的答案必須是已填寫的選項", () => {
    expect(type("choice_item").build({ ...samples.choice_item, correct: "C" }).ok).toBe(false);
  });

  it("選擇題接受小寫答案", () => {
    const built = type("choice_item").build({ ...samples.choice_item, correct: "b" });
    expect(built.ok && built.answerKey.answer).toBe("B");
  });

  it("選擇題選項不可重複", () => {
    expect(type("choice_item").build({ ...samples.choice_item, option_b: "IS" }).ok).toBe(false);
  });

  it("克漏字空格數必須等於答案數", () => {
    expect(type("cloze_item").build({ ...samples.cloze_item, answers: "go" }).ok).toBe(false);
    expect(type("cloze_item").build({ text: "沒有空格", answers: "go" }).ok).toBe(false);
  });

  it("分類項目必須屬於已列出的類別", () => {
    expect(type("sorting_item").build({ ...samples.sorting_item, items: "a = 形容詞\nb = 名詞" }).ok).toBe(false);
  });

  it("分類項目可用分號分隔，方便在 Excel 單格填寫", () => {
    const built = type("sorting_item").build({ ...samples.sorting_item, items: "a = 名詞; b = 動詞" });
    expect(built.ok).toBe(true);
  });

  it("找錯誤的錯誤處必須出現在句子中", () => {
    expect(type("error_item").build({ ...samples.error_item, error_text: "went" }).ok).toBe(false);
  });
});

describe("題目批次匯入", () => {
  const vocab = type("vocab_item");
  const header = templateHeaders(vocab);
  const row = (values: Record<string, string>) => header.map((name) => values[name] ?? "");
  const good = { 單元: "unit 1", 難度: "基礎", 英文單字: "apple", 中文意思: "蘋果" };

  it("範本包含所有必要欄位", () => {
    expect(header).toEqual(expect.arrayContaining(["單元", "難度", "英文單字", "中文意思", "中文解析"]));
  });

  it("單元名稱不分大小寫，難度可用階段名稱", () => {
    const { rows, errors } = parseQuestionTable([header, row(good)], vocab, context);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ unitId: "u1", difficulty: 1, line: 2 });
  });

  it("難度也可填數字", () => {
    const { rows } = parseQuestionTable([header, row({ ...good, 難度: "3" })], vocab, context);
    expect(rows[0].difficulty).toBe(3);
  });

  it("同時回報可匯入列與錯誤列及列號", () => {
    const { rows, errors } = parseQuestionTable(
      [header, row(good), row({ ...good, 單元: "Unit 9" }), row({ ...good, 難度: "9" })],
      vocab,
      context,
    );
    expect(rows).toHaveLength(1);
    expect(errors.map((error) => error.line)).toEqual([3, 4]);
    expect(errors[0].message).toContain("Unit 9");
  });

  it("空白列會被略過，列號仍對應 Excel", () => {
    const { rows, errors } = parseQuestionTable(
      [header, row({}), row({ ...good, 中文意思: "" })],
      vocab,
      context,
    );
    expect(rows).toEqual([]);
    expect(errors[0].line).toBe(3);
  });

  it("主題與文章必須存在於該單元", () => {
    const choice = type("choice_item");
    const head = templateHeaders(choice);
    const cells = (values: Record<string, string>) => head.map((name) => values[name] ?? "");
    const base = { 單元: "Unit 1", 難度: "1", 題幹: "Q", "選項 A": "a", "選項 B": "b", 正確答案: "A" };
    const ok = parseQuestionTable(
      [head, cells({ ...base, 主題: "Past Simple", 文章: "my day" })],
      choice,
      context,
    );
    expect(ok.rows[0]).toMatchObject({ topicId: "t1", passageId: "p1" });
    const bad = parseQuestionTable([head, cells({ ...base, 主題: "Nope", 文章: "Nope" })], choice, context);
    expect(bad.errors[0].message).toContain("主題");
    expect(bad.errors[0].message).toContain("文章");
  });

  it("欄位不符時整份拒絕並提示下載範本", () => {
    const { errors } = parseQuestionTable([["單元", "難度"], ["Unit 1", "1"]], vocab, context);
    expect(errors[0].message).toContain("範本");
  });

  it("會考分級格式錯誤時指出", () => {
    const { errors } = parseQuestionTable([header, row({ ...good, 會考分級: "C" })], vocab, context);
    expect(errors[0].message).toContain("會考分級");
  });

  it("限制單次題數", () => {
    const many = Array.from({ length: 1001 }, () => row(good));
    expect(parseQuestionTable([header, ...many], vocab, context).errors[0].message).toContain("1000");
  });
});
