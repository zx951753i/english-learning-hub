"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/features/auth/session";
import { accessibleTextbookIds } from "@/features/missions/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; saved?: boolean };

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/**
 * 建立任務：一個關卡指派給多個班級或多位學生，每個對象一筆。
 * 關卡必須已發布、區域開放；對象必須看得到這本教材，否則學生收到任務也打不開。
 */
export async function createAssignments(_state: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const levelId = field(formData, "levelId");
  const classIds = formData.getAll("classId").map(String).filter((id) => UUID.test(id));
  const studentIds = formData.getAll("studentId").map(String).filter((id) => UUID.test(id));
  const dueOn = field(formData, "dueOn");
  const note = field(formData, "note");

  if (!UUID.test(levelId)) return { error: "請選擇關卡。" };
  if (classIds.length === 0 && studentIds.length === 0) return { error: "請至少選擇一個班級或一位學生。" };
  if (dueOn && !DATE.test(dueOn)) return { error: "期限格式不正確。" };
  if (note.length > 200) return { error: "給學生的話最多 200 字。" };

  const supabase = await createClient();
  const { data: level } = await supabase
    .from("game_levels")
    .select("id, is_published, island_zones!inner(is_open, textbook_id)")
    .eq("id", levelId)
    .maybeSingle();
  if (!level) return { error: "找不到這個關卡。" };
  const zone = level.island_zones as unknown as { is_open: boolean; textbook_id: string };
  if (!level.is_published || !zone.is_open) return { error: "這個關卡尚未發布或區域已關閉，學生看不到，請先發布。" };

  if (classIds.length > 0) {
    const { data: grants } = await supabase
      .from("class_textbooks")
      .select("class_id")
      .eq("textbook_id", zone.textbook_id)
      .in("class_id", classIds);
    const granted = new Set((grants ?? []).map((row) => row.class_id));
    if (classIds.some((id) => !granted.has(id))) {
      return { error: "有班級還沒有授權這本教材，請先到班級頁授權。" };
    }
  }
  if (studentIds.length > 0) {
    const admin = createAdminClient();
    for (const studentId of studentIds) {
      const books = await accessibleTextbookIds(admin, studentId);
      if (!books.includes(zone.textbook_id)) {
        return { error: "有學生所屬的班級沒有授權這本教材，請先把學生加入有授權的班級。" };
      }
    }
  }

  const base = { level_id: levelId, due_on: dueOn || null, note: note || null };
  const { error } = await supabase
    .from("assignments")
    .insert([
      ...classIds.map((classId) => ({ ...base, class_id: classId })),
      ...studentIds.map((studentId) => ({ ...base, student_id: studentId })),
    ]);
  if (error) return { error: "任務建立失敗，請稍後再試。" };

  revalidatePath("/teacher/assignments");
  redirect("/teacher/assignments?created=1");
}

export async function updateAssignment(assignmentId: string, _state: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const dueOn = field(formData, "dueOn");
  const note = field(formData, "note");
  if (dueOn && !DATE.test(dueOn)) return { error: "期限格式不正確。" };
  if (note.length > 200) return { error: "給學生的話最多 200 字。" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ due_on: dueOn || null, note: note || null })
    .eq("id", assignmentId);
  if (error) return { error: "儲存失敗，請稍後再試。" };
  revalidatePath(`/teacher/assignments/${assignmentId}`);
  return { saved: true };
}

export async function setAssignmentActive(assignmentId: string, active: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").update({ is_active: active }).eq("id", assignmentId);
  if (error) redirect(`/teacher/assignments/${assignmentId}?error=status`);
  revalidatePath("/teacher/assignments");
  redirect(`/teacher/assignments/${assignmentId}`);
}

/** 刪除任務只移除指派，學生的作答紀錄與星星不受影響。 */
export async function deleteAssignment(assignmentId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (error) redirect(`/teacher/assignments/${assignmentId}?error=delete`);
  revalidatePath("/teacher/assignments");
  redirect("/teacher/assignments");
}
