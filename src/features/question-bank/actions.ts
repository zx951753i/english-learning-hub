"use server";

import { isAudioMime } from "@/features/media/rules";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import readXlsx from "read-excel-file/node";
import Papa from "papaparse";
import { decodeCsv } from "@/features/accounts/rules";
import { requireTeacher } from "@/features/auth/session";
import {
  EXAM_BANDS,
  getContentType,
  isSourceType,
  sourceAfterReview,
  type Values,
} from "@/features/question-bank/content-types";
import { loadContentTree } from "@/features/question-bank/data";
import {
  MAX_IMPORT_BYTES,
  parseQuestionTable,
  type ImportError,
  type ImportRow,
} from "@/features/question-bank/import";
import { createClient } from "@/lib/supabase/server";

export type SaveQuestionState = { errors?: string[] };

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const refresh = () => revalidatePath("/teacher", "layout");

export async function saveQuestion(
  questionId: string | null,
  _: SaveQuestionState,
  formData: FormData,
): Promise<SaveQuestionState> {
  await requireTeacher();

  const type = getContentType(field(formData, "contentType"));
  if (!type) return { errors: ["請選擇題目類型。"] };

  const unitId = field(formData, "unitId");
  const difficulty = Number(field(formData, "difficulty"));
  const sourceType = field(formData, "sourceType");
  const explanation = field(formData, "explanation");
  const examBand = field(formData, "examBand");
  const confirmed = formData.get("confirmed") === "on";

  const errors: string[] = [];
  if (!unitId) errors.push("請選擇單元。");
  if (![1, 2, 3, 4].includes(difficulty)) errors.push("請選擇難度。");
  if (!isSourceType(sourceType)) errors.push("請選擇題目來源。");
  if (explanation.length > 2000) errors.push("解析不可超過 2000 字。");
  if (examBand && !EXAM_BANDS.includes(examBand as (typeof EXAM_BANDS)[number])) {
    errors.push("會考分級不正確。");
  }

  const values: Values = Object.fromEntries(
    type.fields.map((item) => [item.key, field(formData, `field_${item.key}`)]),
  );
  const built = type.build(values);
  if (!built.ok) errors.push(...built.errors);
  if (errors.length > 0 || !built.ok) return { errors };

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("textbook_id, stage_id")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return { errors: ["找不到這個單元。"] };

  const row = {
    stage_id: unit.stage_id,
    textbook_id: unit.textbook_id,
    unit_id: unitId,
    topic_id: field(formData, "topicId") || null,
    passage_id: type.usesPassage ? field(formData, "passageId") || null : null,
    content_type: type.key,
    difficulty,
    exam_band: examBand || null,
    content: built.content,
    answer_key: built.answerKey,
    explanation_zh: explanation || null,
    search_text: built.summary,
    source_type: sourceAfterReview(sourceType, confirmed),
    source_note: field(formData, "sourceNote") || null,
    review_status: confirmed ? "confirmed" : "draft",
    is_active: confirmed,
  };

  const { error } = questionId
    ? await supabase.from("questions").update(row).eq("id", questionId)
    : await supabase.from("questions").insert(row);
  if (error) return { errors: ["儲存失敗，請稍後再試。"] };

  refresh();
  if (formData.get("intent") === "next") {
    const next = new URLSearchParams({
      textbook: unit.textbook_id,
      unit: unitId,
      type: type.key,
      difficulty: String(difficulty),
      source: sourceType,
      saved: String(Date.now()),
    });
    redirect(`/teacher/questions/new?${next}`);
  }
  redirect("/teacher/questions?saved=1");
}

const BULK_ACTIONS = ["confirm", "enable", "disable", "archive"] as const;

export async function applyBulkAction(formData: FormData) {
  await requireTeacher();
  const action = field(formData, "bulk") as (typeof BULK_ACTIONS)[number];
  const ids = formData.getAll("questionId").map(String).filter(Boolean);
  const back = field(formData, "back") || "/teacher/questions";
  if (ids.length === 0 || !BULK_ACTIONS.includes(action)) redirect(back);

  const supabase = await createClient();
  const base = () => supabase.from("questions");
  let failed = false;

  if (action === "confirm") {
    await base()
      .update({ source_type: "ai_approved" })
      .in("id", ids)
      .eq("source_type", "ai_generated");
    const { error } = await base()
      .update({ review_status: "confirmed", is_active: true })
      .in("id", ids)
      .is("deleted_at", null);
    failed = Boolean(error);
  } else if (action === "enable") {
    const { error } = await base()
      .update({ is_active: true })
      .in("id", ids)
      .eq("review_status", "confirmed")
      .is("deleted_at", null);
    failed = Boolean(error);
  } else if (action === "disable") {
    const { error } = await base().update({ is_active: false }).in("id", ids);
    failed = Boolean(error);
  } else {
    const { error } = await base()
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .in("id", ids);
    failed = Boolean(error);
  }

  refresh();
  if (failed) {
    const url = new URL(back, "http://local");
    url.searchParams.set("error", "bulk");
    redirect(`${url.pathname}${url.search}`);
  }
  redirect(back);
}

export async function archiveQuestion(id: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) redirect(`/teacher/questions/${id}?error=archive`);
  refresh();
  redirect("/teacher/questions");
}

async function readTable(file: File): Promise<string[][]> {
  const bytes = await file.arrayBuffer();
  if (/\.xlsx$/i.test(file.name)) {
    const sheets = await readXlsx(Buffer.from(bytes));
    return sheets[0].data.map((row) =>
      row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
    );
  }
  const parsed = Papa.parse<string[]>(decodeCsv(bytes).replace(/^﻿/, ""), {
    skipEmptyLines: false,
  });
  return parsed.data;
}

export type PreviewState = { errors?: ImportError[] };

export async function previewImport(_: PreviewState, formData: FormData): Promise<PreviewState> {
  await requireTeacher();

  const textbookId = field(formData, "textbookId");
  const type = getContentType(field(formData, "contentType"));
  const file = formData.get("file");
  if (!textbookId) return { errors: [{ line: 0, message: "請選擇教材。" }] };
  if (!type) return { errors: [{ line: 0, message: "請選擇題目類型。" }] };
  if (!(file instanceof File) || file.size === 0) {
    return { errors: [{ line: 0, message: "請選擇檔案。" }] };
  }
  if (file.size > MAX_IMPORT_BYTES) return { errors: [{ line: 0, message: "檔案不可超過 3 MB。" }] };
  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    return { errors: [{ line: 0, message: "請上傳 .xlsx 或 .csv 檔案。" }] };
  }

  let table: string[][];
  try {
    table = await readTable(file);
  } catch {
    return { errors: [{ line: 0, message: "無法讀取這個檔案，請確認它是範本格式。" }] };
  }

  const { stages, textbooks } = await loadContentTree();
  const book = textbooks.find((item) => item.id === textbookId);
  const stage = stages.find((item) => item.id === book?.stage_id);
  if (!book || !stage) return { errors: [{ line: 0, message: "找不到這本教材。" }] };

  const supabase = await createClient();
  const { data: media } = await supabase.from("media_assets").select("file_name, mime_type");

  const { rows, errors } = parseQuestionTable(table, type, {
    mediaNames: new Set(media?.filter((item) => !isAudioMime(item.mime_type)).map((item) => item.file_name)),
    audioNames: new Set(media?.filter((item) => isAudioMime(item.mime_type)).map((item) => item.file_name)),
    difficultyLabels: stage.difficulty_labels,
    units: book.units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      topics: unit.learning_topics,
      passages: unit.passages,
    })),
  });
  if (rows.length === 0 && errors.length > 0) return { errors };

  const { data, error } = await supabase
    .from("import_batches")
    .insert({
      file_name: file.name.slice(0, 200),
      content_type: type.key,
      textbook_id: textbookId,
      total_rows: rows.length + errors.length,
      success_rows: rows.length,
      error_rows: errors.length,
      errors,
      rows,
    })
    .select("id")
    .single();
  if (error) return { errors: [{ line: 0, message: "無法建立預覽，請稍後再試。" }] };

  redirect(`/teacher/questions/import/${data.id}`);
}

export async function confirmImport(batchId: string, formData: FormData) {
  await requireTeacher();
  const sourceType = field(formData, "sourceType");
  const confirmed = formData.get("confirmed") === "on";
  const failUrl = `/teacher/questions/import/${batchId}?error=`;
  if (!isSourceType(sourceType)) redirect(`${failUrl}source`);

  const supabase = await createClient();
  // 先鎖定狀態，重複送出時第二次會找不到資料。
  const { data: batch } = await supabase
    .from("import_batches")
    .update({ status: "imported" })
    .eq("id", batchId)
    .eq("status", "previewed")
    .select("id, content_type, textbook_id, rows, textbooks(stage_id)")
    .maybeSingle();
  if (!batch) redirect(`/teacher/questions/import/${batchId}`);

  const rows = batch.rows as ImportRow[];
  const stage = batch.textbooks as unknown as { stage_id: string };
  const { error } = await supabase.from("questions").insert(
    rows.map((row) => ({
      stage_id: stage.stage_id,
      textbook_id: batch.textbook_id,
      unit_id: row.unitId,
      topic_id: row.topicId,
      passage_id: row.passageId,
      content_type: batch.content_type,
      difficulty: row.difficulty,
      exam_band: row.examBand,
      content: row.content,
      answer_key: row.answerKey,
      explanation_zh: row.explanation,
      search_text: row.summary,
      source_type: sourceAfterReview(sourceType, confirmed),
      source_note: row.sourceNote,
      review_status: confirmed ? "confirmed" : "draft",
      is_active: confirmed,
      import_batch_id: batchId,
    })),
  );
  if (error) {
    await supabase.from("import_batches").update({ status: "previewed" }).eq("id", batchId);
    redirect(`${failUrl}insert`);
  }

  refresh();
  redirect(`/teacher/questions?imported=${rows.length}`);
}

export async function cancelImport(batchId: string) {
  await requireTeacher();
  const supabase = await createClient();
  await supabase
    .from("import_batches")
    .update({ status: "cancelled", rows: [] })
    .eq("id", batchId)
    .eq("status", "previewed");
  refresh();
  redirect("/teacher/questions/import");
}
