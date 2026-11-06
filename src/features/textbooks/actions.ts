"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/features/auth/session";
import { isSourceType, SKILLS } from "@/features/question-bank/content-types";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; saved?: boolean };

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optional = (formData: FormData, key: string) => field(formData, key) || null;
const TEXTBOOK_KINDS = ["textbook", "exam_prep", "custom"];

const refresh = () => revalidatePath("/teacher", "layout");

function textbookFields(formData: FormData) {
  return {
    title: field(formData, "title"),
    publisher: optional(formData, "publisher"),
    series: optional(formData, "series"),
    grade: optional(formData, "grade"),
    kind: field(formData, "kind") || "textbook",
  };
}

const validateTextbook = (fields: ReturnType<typeof textbookFields>) => {
  if (fields.title.length < 1 || fields.title.length > 120) return "教材名稱需為 1–120 字。";
  if (!TEXTBOOK_KINDS.includes(fields.kind)) return "教材類型不正確。";
  return null;
};

export async function createTextbook(_: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const fields = textbookFields(formData);
  const stageId = field(formData, "stageId");
  const unitCount = Number(field(formData, "unitCount") || 0);
  const invalid = validateTextbook(fields);
  if (invalid) return { error: invalid };
  if (!stageId) return { error: "請選擇學習階段。" };
  if (!Number.isInteger(unitCount) || unitCount < 0 || unitCount > 60) {
    return { error: "單元數需為 0–60。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("textbooks")
    .insert({ ...fields, stage_id: stageId })
    .select("id")
    .single();
  if (error) return { error: "建立失敗，請稍後再試。" };

  if (unitCount > 0) {
    const units = Array.from({ length: unitCount }, (_, index) => ({
      textbook_id: data.id,
      stage_id: stageId,
      title: `Unit ${index + 1}`,
      order_index: index + 1,
    }));
    const { error: unitError } = await supabase.from("units").insert(units);
    if (unitError) {
      refresh();
      redirect(`/teacher/textbooks/${data.id}?error=units`);
    }
  }

  refresh();
  redirect(`/teacher/textbooks/${data.id}`);
}

export async function updateTextbook(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const fields = textbookFields(formData);
  const invalid = validateTextbook(fields);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("textbooks").update(fields).eq("id", id);
  if (error) return { error: "更新失敗，請稍後再試。" };
  refresh();
  return { saved: true };
}

export async function setTextbookActive(id: string, active: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("textbooks").update({ is_active: active }).eq("id", id);
  if (error) redirect(`/teacher/textbooks/${id}?error=status`);
  refresh();
}

export async function deleteTextbook(id: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("textbooks").delete().eq("id", id);
  if (error) redirect(`/teacher/textbooks/${id}?error=delete`);
  refresh();
  redirect("/teacher/textbooks");
}

export async function createUnit(textbookId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const title = field(formData, "title");
  if (title.length < 1 || title.length > 120) return { error: "單元名稱需為 1–120 字。" };

  const supabase = await createClient();
  const { data: book } = await supabase
    .from("textbooks")
    .select("stage_id")
    .eq("id", textbookId)
    .maybeSingle();
  if (!book) return { error: "找不到這本教材。" };

  const { data: last } = await supabase
    .from("units")
    .select("order_index")
    .eq("textbook_id", textbookId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("units").insert({
    textbook_id: textbookId,
    stage_id: book.stage_id,
    title,
    order_index: (last?.order_index ?? 0) + 1,
  });
  if (error) return { error: "新增失敗，請稍後再試。" };
  refresh();
  return { saved: true };
}

export async function updateUnit(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const title = field(formData, "title");
  if (title.length < 1 || title.length > 120) return { error: "單元名稱需為 1–120 字。" };
  const supabase = await createClient();
  const { error } = await supabase.from("units").update({ title }).eq("id", id);
  if (error) return { error: "更新失敗，請稍後再試。" };
  refresh();
  return { saved: true };
}

export async function moveUnit(textbookId: string, unitId: string, direction: -1 | 1) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_unit", {
    p_unit_id: unitId,
    p_direction: direction,
  });
  if (error) redirect(`/teacher/textbooks/${textbookId}?error=move`);
  refresh();
}

export async function setUnitActive(id: string, active: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("units").update({ is_active: active }).eq("id", id);
  if (error) redirect(`/teacher/units/${id}?error=status`);
  refresh();
}

export async function deleteUnit(id: string, textbookId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("units").delete().eq("id", id);
  if (error) redirect(`/teacher/units/${id}?error=delete`);
  refresh();
  redirect(`/teacher/textbooks/${textbookId}`);
}

const parseTags = (value: string) =>
  [...new Set(value.split(/[,，、]/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

export async function saveTopic(
  unitId: string,
  topicId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireTeacher();
  const title = field(formData, "title");
  const skill = field(formData, "skill");
  if (title.length < 1 || title.length > 120) return { error: "主題名稱需為 1–120 字。" };
  if (!SKILLS.some((item) => item.key === skill)) return { error: "請選擇技能類別。" };
  const values = { title, skill, concept_tags: parseTags(field(formData, "conceptTags")) };

  const supabase = await createClient();
  const { error } = topicId
    ? await supabase.from("learning_topics").update(values).eq("id", topicId)
    : await supabase.from("learning_topics").insert({ ...values, unit_id: unitId });
  if (error) return { error: "儲存失敗，請稍後再試。" };
  refresh();
  return { saved: true };
}

export async function deleteTopic(unitId: string, topicId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("learning_topics").delete().eq("id", topicId);
  if (error) redirect(`/teacher/units/${unitId}?error=topic`);
  refresh();
}

export async function savePassage(
  unitId: string,
  passageId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireTeacher();
  const title = field(formData, "title");
  const body = field(formData, "body");
  const sourceType = field(formData, "sourceType");
  if (title.length < 1 || title.length > 120) return { error: "文章標題需為 1–120 字。" };
  if (body.length < 1 || body.length > 20000) return { error: "文章內容需為 1–20000 字。" };
  if (!isSourceType(sourceType)) return { error: "請選擇內容來源。" };
  const values = {
    title,
    body,
    source_type: sourceType,
    source_note: optional(formData, "sourceNote"),
  };

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("stage_id")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return { error: "找不到這個單元。" };

  const { error } = passageId
    ? await supabase.from("passages").update(values).eq("id", passageId)
    : await supabase.from("passages").insert({ ...values, unit_id: unitId, stage_id: unit.stage_id });
  if (error) return { error: "儲存失敗，請稍後再試。" };
  refresh();
  return { saved: true };
}

export async function deletePassage(unitId: string, passageId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("passages").delete().eq("id", passageId);
  if (error) redirect(`/teacher/units/${unitId}?error=passage`);
  refresh();
}
