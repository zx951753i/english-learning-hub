/**
 * 題目內容與遊戲分離：老師只維護這 7 種內容，遊戲再決定如何呈現。
 * 表單與 Excel 匯入共用同一份欄位與驗證規則。
 */

export type ContentTypeKey =
  | "vocab_item"
  | "phonics_item"
  | "sentence_item"
  | "choice_item"
  | "cloze_item"
  | "sorting_item"
  | "error_item";

export type Values = Record<string, string>;
type Json = Record<string, unknown>;
export type BuildResult =
  | { ok: true; content: Json; answerKey: Json; summary: string }
  | { ok: false; errors: string[] };

export type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  options?: string[];
  /** 不是單獨必填，但也不標示為選填，例如文字或圖片擇一。 */
  conditional?: boolean;
  /** 值為媒體庫中的圖片檔名。 */
  image?: boolean;
};

export type ContentType = {
  key: ContentTypeKey;
  label: string;
  description: string;
  fields: FieldDef[];
  usesPassage?: boolean;
  build: (values: Values) => BuildResult;
  flatten: (content: Json, answerKey: Json) => Values;
};

const clean = (value: string | undefined) => (value ?? "").trim();
const splitBy = (value: string, separator: RegExp) =>
  value.split(separator).map((part) => part.trim()).filter(Boolean);
const list = (value: string) => splitBy(value, /[,，、]/);
const slashList = (value: string) => splitBy(value, /\s*\/\s*/);
const lines = (value: string) => splitBy(value, /\r?\n|；|;/);
const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const text = (value: unknown) => (typeof value === "string" ? value : "");

function requireFields(fields: FieldDef[], values: Values) {
  return fields
    .filter((field) => field.required && !clean(values[field.key]))
    .map((field) => `請填寫「${field.label}」。`);
}

const defineType = (
  type: Omit<ContentType, "build"> & { build: (values: Values) => BuildResult },
): ContentType => ({
  ...type,
  build(values) {
    const missing = requireFields(type.fields, values);
    return missing.length > 0 ? { ok: false, errors: missing } : type.build(values);
  },
});

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export const CONTENT_TYPES: ContentType[] = [
  defineType({
    key: "vocab_item",
    label: "單字",
    description: "單字、中文與詞性，可用於配對、選擇與拼字",
    fields: [
      { key: "word", label: "英文單字", required: true },
      { key: "meaning_zh", label: "中文意思", required: true },
      { key: "part_of_speech", label: "詞性", hint: "例如 n.、v.、adj." },
      { key: "example_sentence", label: "例句" },
      { key: "image", label: "圖片", image: true, hint: "媒體庫中的檔名，例如 apple.png" },
    ],
    build(values) {
      const word = clean(values.word);
      return {
        ok: true,
        content: {
          word,
          meaning_zh: clean(values.meaning_zh),
          part_of_speech: clean(values.part_of_speech),
          example_sentence: clean(values.example_sentence),
          image: clean(values.image).toLowerCase(),
        },
        answerKey: { answer: word },
        summary: `${word}｜${clean(values.meaning_zh)}`,
      };
    },
    flatten: (content) => ({
      word: text(content.word),
      meaning_zh: text(content.meaning_zh),
      part_of_speech: text(content.part_of_speech),
      example_sentence: text(content.example_sentence),
      image: text(content.image),
    }),
  }),
  defineType({
    key: "phonics_item",
    label: "自然發音",
    description: "字母、發音與例字",
    fields: [
      { key: "letter", label: "字母或字母組合", required: true },
      { key: "sound", label: "發音", required: true, hint: "例如 /æ/" },
      { key: "example_words", label: "例字", required: true, hint: "以逗號分隔，例如 cat, hat" },
    ],
    build(values) {
      const letter = clean(values.letter);
      const sound = clean(values.sound);
      const words = list(clean(values.example_words));
      if (words.length === 0) return { ok: false, errors: ["請至少填寫一個例字。"] };
      return {
        ok: true,
        content: { letter, sound, example_words: words },
        answerKey: { answer: sound },
        summary: `${letter} ${sound}｜${words.join(", ")}`,
      };
    },
    flatten: (content) => ({
      letter: text(content.letter),
      sound: text(content.sound),
      example_words: strings(content.example_words).join(", "),
    }),
  }),
  defineType({
    key: "sentence_item",
    label: "句子",
    description: "可用於句子重組、中翻英與句型改寫",
    fields: [
      { key: "sentence_en", label: "英文句子", required: true },
      { key: "sentence_zh", label: "中文翻譯", required: true },
      {
        key: "chunks",
        label: "重組切分",
        hint: "以 / 分隔，例如 I / like / apples；留空時依空格切分",
      },
      { key: "alternatives", label: "其他可接受答案", multiline: true, hint: "一行一句" },
      { key: "instruction", label: "作答指示", hint: "例如 改成否定句" },
    ],
    build(values) {
      const sentence = clean(values.sentence_en);
      const given = slashList(clean(values.chunks));
      const chunks = given.length > 0 ? given : sentence.split(/\s+/);
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      if (given.length > 0 && normalize(given.join(" ")) !== normalize(sentence)) {
        return { ok: false, errors: ["「重組切分」連起來必須與英文句子相同。"] };
      }
      return {
        ok: true,
        content: {
          sentence_zh: clean(values.sentence_zh),
          chunks,
          instruction: clean(values.instruction),
        },
        answerKey: { answer: sentence, alternatives: lines(clean(values.alternatives)) },
        summary: `${sentence}｜${clean(values.sentence_zh)}`,
      };
    },
    flatten: (content, answerKey) => ({
      sentence_en: text(answerKey.answer),
      sentence_zh: text(content.sentence_zh),
      chunks: strings(content.chunks).join(" / "),
      alternatives: strings(answerKey.alternatives).join("\n"),
      instruction: text(content.instruction),
    }),
  }),
  defineType({
    key: "choice_item",
    label: "選擇題",
    description: "文法、閱讀、聽力都可使用；閱讀題可連結文章",
    usesPassage: true,
    fields: [
      { key: "stem", label: "題幹", required: true, multiline: true },
      { key: "image", label: "題幹圖片", image: true },
      { key: "option_a", label: "選項 A", conditional: true, hint: "文字或圖片至少填一項" },
      { key: "option_a_image", label: "選項 A 圖片", image: true },
      { key: "option_b", label: "選項 B", conditional: true, hint: "文字或圖片至少填一項" },
      { key: "option_b_image", label: "選項 B 圖片", image: true },
      { key: "option_c", label: "選項 C" },
      { key: "option_c_image", label: "選項 C 圖片", image: true },
      { key: "option_d", label: "選項 D" },
      { key: "option_d_image", label: "選項 D 圖片", image: true },
      { key: "correct", label: "正確答案", required: true, options: [...OPTION_LETTERS] },
    ],
    build(values) {
      const correct = clean(values.correct).toUpperCase();
      const entries = OPTION_LETTERS.flatMap((letter) => {
        const lower = letter.toLowerCase();
        const value = clean(values[`option_${lower}`]);
        const image = clean(values[`option_${lower}_image`]).toLowerCase();
        return value || image ? [{ key: letter, text: value, image }] : [];
      });
      const errors: string[] = [];
      if (entries.length < 2) errors.push("至少需要 2 個選項。");
      if (!entries.some((option) => option.key === correct)) {
        errors.push("正確答案必須是已填寫的選項。");
      }
      const identities = entries.map((option) => `${option.text.toLowerCase()}|${option.image}`);
      if (new Set(identities).size !== entries.length) {
        errors.push("選項內容不可重複。");
      }
      if (errors.length > 0) return { ok: false, errors };
      return {
        ok: true,
        content: {
          stem: clean(values.stem),
          image: clean(values.image).toLowerCase(),
          options: entries,
        },
        answerKey: { answer: correct },
        summary: clean(values.stem),
      };
    },
    flatten(content, answerKey) {
      const options = Array.isArray(content.options)
        ? (content.options as { key: string; text: string; image?: string }[])
        : [];
      const find = (letter: string) => options.find((option) => option.key === letter);
      const entry = (letter: string) => ({
        [`option_${letter.toLowerCase()}`]: find(letter)?.text ?? "",
        [`option_${letter.toLowerCase()}_image`]: find(letter)?.image ?? "",
      });
      return {
        stem: text(content.stem),
        image: text(content.image),
        ...entry("A"),
        ...entry("B"),
        ...entry("C"),
        ...entry("D"),
        correct: text(answerKey.answer),
      };
    },
  }),
  defineType({
    key: "cloze_item",
    label: "克漏字",
    description: "在短文中以 ___ 標示空格",
    fields: [
      {
        key: "text",
        label: "短文",
        required: true,
        multiline: true,
        hint: "每個空格請輸入三個底線 ___",
      },
      { key: "answers", label: "各格答案", required: true, hint: "依序以 / 分隔，例如 go / by" },
    ],
    build(values) {
      const body = clean(values.text);
      const answers = slashList(clean(values.answers));
      const blanks = body.match(/_{3,}/g)?.length ?? 0;
      if (blanks === 0) return { ok: false, errors: ["短文中至少要有一個 ___ 空格。"] };
      if (blanks !== answers.length) {
        return { ok: false, errors: [`短文有 ${blanks} 格，但填了 ${answers.length} 個答案。`] };
      }
      return {
        ok: true,
        content: { text: body, blank_count: blanks },
        answerKey: { answers },
        summary: body.slice(0, 120),
      };
    },
    flatten: (content, answerKey) => ({
      text: text(content.text),
      answers: strings(answerKey.answers).join(" / "),
    }),
  }),
  defineType({
    key: "sorting_item",
    label: "分類",
    description: "把項目放進正確的類別",
    fields: [
      { key: "prompt", label: "題目說明", required: true },
      { key: "categories", label: "類別", required: true, hint: "以 / 分隔，例如 名詞 / 動詞" },
      {
        key: "items",
        label: "項目與類別",
        required: true,
        multiline: true,
        hint: "一行一個，或以分號分隔，格式：項目 = 類別",
      },
    ],
    build(values) {
      const categories = slashList(clean(values.categories));
      const pairs = lines(clean(values.items)).map((line) => {
        const [item, category] = line.split("=").map((part) => part?.trim() ?? "");
        return { item, category };
      });
      const errors: string[] = [];
      if (categories.length < 2) errors.push("至少需要 2 個類別。");
      if (pairs.length < 2) errors.push("至少需要 2 個項目。");
      for (const { item, category } of pairs) {
        if (!item || !category) errors.push("項目格式應為「項目 = 類別」。");
        else if (!categories.includes(category)) errors.push(`「${category}」不在類別清單中。`);
      }
      if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };
      return {
        ok: true,
        content: {
          prompt: clean(values.prompt),
          categories,
          items: pairs.map((pair) => pair.item),
        },
        answerKey: { placements: pairs },
        summary: clean(values.prompt),
      };
    },
    flatten(content, answerKey) {
      const placements = Array.isArray(answerKey.placements)
        ? (answerKey.placements as { item: string; category: string }[])
        : [];
      return {
        prompt: text(content.prompt),
        categories: strings(content.categories).join(" / "),
        items: placements.map((pair) => `${pair.item} = ${pair.category}`).join("\n"),
      };
    },
  }),
  defineType({
    key: "error_item",
    label: "找錯誤",
    description: "找出句子中的錯誤並修正",
    fields: [
      { key: "sentence", label: "含錯誤的句子", required: true },
      { key: "error_text", label: "錯誤處", required: true, hint: "必須與句子內的文字完全相同" },
      { key: "correction", label: "正確寫法", required: true },
    ],
    build(values) {
      const sentence = clean(values.sentence);
      const errorText = clean(values.error_text);
      const correction = clean(values.correction);
      if (!sentence.includes(errorText)) {
        return { ok: false, errors: ["「錯誤處」必須出現在句子中。"] };
      }
      if (errorText === correction) return { ok: false, errors: ["正確寫法不可與錯誤處相同。"] };
      return {
        ok: true,
        content: { sentence },
        answerKey: { error_text: errorText, correction },
        summary: sentence,
      };
    },
    flatten: (content, answerKey) => ({
      sentence: text(content.sentence),
      error_text: text(answerKey.error_text),
      correction: text(answerKey.correction),
    }),
  }),
];

export const getContentType = (key: string) => CONTENT_TYPES.find((type) => type.key === key);

export const contentTypeLabel = (key: string) => getContentType(key)?.label ?? key;

export const SOURCE_TYPES = [
  { key: "teacher_material", label: "老師提供的資料" },
  { key: "teacher_original", label: "老師原創" },
  { key: "ai_draft", label: "AI 草擬，待老師確認" },
] as const;

export const isSourceType = (value: string) =>
  SOURCE_TYPES.some((source) => source.key === value);

export const EXAM_BANDS = ["B", "B+", "A", "A++"] as const;

export const SKILLS = [
  { key: "vocabulary", label: "單字" },
  { key: "phonics", label: "自然發音" },
  { key: "grammar", label: "文法" },
  { key: "sentence", label: "句型" },
  { key: "listening", label: "聽力" },
  { key: "speaking", label: "口說" },
  { key: "reading", label: "閱讀" },
  { key: "writing", label: "寫作" },
  { key: "exam", label: "考試練習" },
] as const;

export const skillLabel = (key: string) =>
  SKILLS.find((skill) => skill.key === key)?.label ?? key;
