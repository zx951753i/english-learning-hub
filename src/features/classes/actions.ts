"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ClassFormState = { error?: string; saved?: boolean };

const readClassFields = (formData: FormData) => ({
  name: String(formData.get("name") ?? "").trim(),
  description: String(formData.get("description") ?? "").trim() || null,
});

function validate(name: string, description: string | null) {
  if (name.length < 1 || name.length > 60) return "班級名稱需為 1–60 字。";
  if (description && description.length > 300) return "說明不可超過 300 字。";
  return null;
}

export async function createClass(_: ClassFormState, formData: FormData): Promise<ClassFormState> {
  await requireTeacher();
  const { name, description } = readClassFields(formData);
  const stageId = String(formData.get("stageId") ?? "");
  const invalid = validate(name, description);
  if (invalid) return { error: invalid };
  if (!stageId) return { error: "請選擇學習階段。" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({ name, description, stage_id: stageId })
    .select("id")
    .single();
  if (error) return { error: "建立失敗，請稍後再試。" };

  revalidatePath("/teacher", "layout");
  redirect(`/teacher/classes/${data.id}`);
}

export async function updateClass(
  classId: string,
  _: ClassFormState,
  formData: FormData,
): Promise<ClassFormState> {
  await requireTeacher();
  const { name, description } = readClassFields(formData);
  const invalid = validate(name, description);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({ name, description })
    .eq("id", classId);
  if (error) return { error: "更新失敗，請稍後再試。" };

  revalidatePath("/teacher", "layout");
  return { saved: true };
}

export async function setClassArchived(classId: string, archived: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({ is_archived: archived })
    .eq("id", classId);
  if (error) redirect(`/teacher/classes/${classId}?error=archive`);
  revalidatePath("/teacher", "layout");
}

export async function addStudentsToClass(classId: string, formData: FormData) {
  await requireTeacher();
  const studentIds = formData.getAll("studentId").map(String).filter(Boolean);
  if (studentIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("student_classes").upsert(
    studentIds.map((studentId) => ({
      student_id: studentId,
      class_id: classId,
      joined_at: new Date().toISOString(),
      left_at: null,
    })),
    { onConflict: "student_id,class_id" },
  );
  if (error) redirect(`/teacher/classes/${classId}?error=members`);
  revalidatePath("/teacher", "layout");
}

/** 保留成員紀錄並標記離班時間，日後學習紀錄仍可對應原班級。 */
export async function removeStudentFromClass(classId: string, studentId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_classes")
    .update({ left_at: new Date().toISOString() })
    .eq("class_id", classId)
    .eq("student_id", studentId);
  if (error) redirect(`/teacher/classes/${classId}?error=members`);
  revalidatePath("/teacher", "layout");
}
