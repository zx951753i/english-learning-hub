import {
  EXAM_BANDS,
  type ContentType,
  type Values,
} from "@/features/question-bank/content-types";

export const MAX_QUESTION_ROWS = 1000;
export const MAX_IMPORT_BYTES = 3 * 1024 * 1024;

export type ImportContext = {
  units: {
    id: string;
    title: string;
    topics: { id: string; title: string }[];
    passages: { id: string; title: string }[];
  }[];
  difficultyLabels: string[];
  /** 媒體庫內的小寫檔名（圖片）。 */
  mediaNames?: Set<string>;
  /** 媒體庫內的小寫檔名（音檔）。 */
  audioNames?: Set<string>;
};

export type ImportRow = {
  line: number;
  unitId: string;
  topicId: string | null;
  passageId: string | null;
  difficulty: number;
  examBand: string | null;
  explanation: string | null;
  sourceNote: string | null;
  content: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  summary: string;
};

export type ImportError = { line: number; message: string };

const COMMON_HEADERS = {
  unit: "單元",
  topic: "主題",
  difficulty: "難度",
  examBand: "會考分級",
  explanation: "中文解析",
  sourceNote: "來源說明",
  passage: "文章",
};

export function templateHeaders(type: ContentType) {
  return [
    COMMON_HEADERS.unit,
    COMMON_HEADERS.topic,
    COMMON_HEADERS.difficulty,
    ...type.fields.map((field) => field.label),
    COMMON_HEADERS.explanation,
    COMMON_HEADERS.sourceNote,
    ...(type.usesPassage ? [COMMON_HEADERS.passage] : []),
    COMMON_HEADERS.examBand,
  ];
}

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function findByTitle<T extends { title: string }>(items: T[], title: string) {
  return items.find((item) => normalizeName(item.title) === normalizeName(title));
}

function parseDifficulty(value: string, labels: string[]) {
  const trimmed = value.trim();
  if (/^[1-4]$/.test(trimmed)) return Number(trimmed);
  const index = labels.findIndex((label) => normalizeName(label) === normalizeName(trimmed));
  return index >= 0 ? index + 1 : null;
}

/** 表格第一列為欄名；回傳時的 line 對應 Excel 的列號。 */
export function parseQuestionTable(
  table: string[][],
  type: ContentType,
  context: ImportContext,
): { rows: ImportRow[]; errors: ImportError[] } {
  const [header, ...body] = table;
  if (!header) return { rows: [], errors: [{ line: 1, message: "檔案沒有內容。" }] };

  const columns = header.map((cell) => cell.trim());
  const required = [
    COMMON_HEADERS.unit,
    COMMON_HEADERS.difficulty,
    ...type.fields.filter((field) => field.required).map((field) => field.label),
  ];
  const missing = required.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        { line: 1, message: `缺少欄位：${missing.join("、")}。請下載「${type.label}」範本。` },
      ],
    };
  }

  const dataRows = body
    .map((cells, index) => ({ cells, line: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim()));
  if (dataRows.length === 0) return { rows: [], errors: [{ line: 2, message: "檔案沒有題目。" }] };
  if (dataRows.length > MAX_QUESTION_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, message: `一次最多匯入 ${MAX_QUESTION_ROWS} 題。` }],
    };
  }

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];

  for (const { cells, line } of dataRows) {
    const read = (name: string) => {
      const index = columns.indexOf(name);
      return index >= 0 ? (cells[index] ?? "").trim() : "";
    };
    const rowErrors: string[] = [];

    const unitName = read(COMMON_HEADERS.unit);
    const unit = findByTitle(context.units, unitName);
    if (!unit) rowErrors.push(`找不到單元「${unitName}」。`);

    const topicName = read(COMMON_HEADERS.topic);
    const topic = unit && topicName ? findByTitle(unit.topics, topicName) : undefined;
    if (unit && topicName && !topic) rowErrors.push(`此單元沒有主題「${topicName}」。`);

    const passageName = type.usesPassage ? read(COMMON_HEADERS.passage) : "";
    const passage = unit && passageName ? findByTitle(unit.passages, passageName) : undefined;
    if (unit && passageName && !passage) rowErrors.push(`此單元沒有文章「${passageName}」。`);

    const difficulty = parseDifficulty(read(COMMON_HEADERS.difficulty), context.difficultyLabels);
    if (!difficulty) rowErrors.push("難度需為 1–4，或該階段的難度名稱。");

    const examBand = read(COMMON_HEADERS.examBand);
    if (examBand && !EXAM_BANDS.includes(examBand as (typeof EXAM_BANDS)[number])) {
      rowErrors.push("會考分級需為 B、B+、A 或 A++。");
    }

    const values: Values = Object.fromEntries(
      type.fields.map((field) => [field.key, read(field.label)]),
    );
    for (const field of type.fields.filter((item) => item.image)) {
      const name = (values[field.key] ?? "").toLowerCase();
      if (name && context.mediaNames && !context.mediaNames.has(name)) {
        rowErrors.push(`媒體庫找不到圖片「${values[field.key]}」。`);
      }
    }
    for (const field of type.fields.filter((item) => item.audio)) {
      const name = (values[field.key] ?? "").toLowerCase();
      if (name && context.audioNames && !context.audioNames.has(name)) {
        rowErrors.push(`媒體庫找不到音檔「${values[field.key]}」。`);
      }
    }
    const built = type.build(values);
    if (!built.ok) rowErrors.push(...built.errors);

    if (rowErrors.length > 0 || !built.ok || !unit || !difficulty) {
      errors.push({ line, message: rowErrors.join(" ") });
      continue;
    }

    rows.push({
      line,
      unitId: unit.id,
      topicId: topic?.id ?? null,
      passageId: passage?.id ?? null,
      difficulty,
      examBand: examBand || null,
      explanation: read(COMMON_HEADERS.explanation) || null,
      sourceNote: read(COMMON_HEADERS.sourceNote) || null,
      content: built.content,
      answerKey: built.answerKey,
      summary: built.summary,
    });
  }

  return { rows, errors };
}
