"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  USERNAME_HINT,
  decodeCsv,
  generatePassword,
  isValidDisplayName,
  isValidPassword,
  isValidUsername,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
  parseStudentCsv,
  toAuthEmail,
  type RowError,
} from "@/features/accounts/rules";
import { createStudentAccount, setStudentActive } from "@/features/accounts/service";
import { requireTeacher } from "@/features/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Credential = { displayName: string; username: string; password: string };

export type CreateStudentState = { error?: string; credential?: Credential };

export async function createStudent(
  _: CreateStudentState,
  formData: FormData,
): Promise<CreateStudentState> {
  await requireTeacher();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const classId = String(formData.get("classId") ?? "");

  if (!isValidDisplayName(displayName)) return { error: "姓名需為 1–50 字。" };
  if (!isValidUsername(username)) return { error: `帳號格式不正確。${USERNAME_HINT}。` };
  if (password && !isValidPassword(password)) {
    return { error: `密碼需為 ${MIN_PASSWORD_LENGTH}–72 字；留空會自動產生。` };
  }

  const result = await createStudentAccount(createAdminClient(), {
    displayName,
    username,
    password,
  });
  if (!result.ok) {
    return {
      error: result.reason === "duplicate" ? "這個帳號已有人使用。" : "建立失敗，請稍後再試。",
    };
  }

  if (classId) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("student_classes")
      .insert({ student_id: result.id, class_id: classId });
    if (error) {
      revalidatePath("/teacher", "layout");
      return {
        error: "帳號已建立，但加入班級失敗，請到班級頁面加入。",
        credential: { displayName, username, password: result.password },
      };
    }
  }

  revalidatePath("/teacher", "layout");
  return { credential: { displayName, username, password: result.password } };
}

export type ImportState = {
  errors?: RowError[];
  created?: Credential[];
  failed?: RowError[];
};

export async function importStudents(_: ImportState, formData: FormData): Promise<ImportState> {
  await requireTeacher();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { errors: [{ line: 0, message: "請選擇 CSV 檔案。" }] };
  }
  if (file.size > 1024 * 1024) return { errors: [{ line: 0, message: "檔案不可超過 1 MB。" }] };

  const { rows, errors } = parseStudentCsv(decodeCsv(await file.arrayBuffer()));
  if (errors.length > 0) return { errors };

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("username")
    .in("username", rows.map((row) => row.username));
  if (lookupError) return { errors: [{ line: 0, message: "無法檢查帳號，請稍後再試。" }] };

  const taken = new Set(existing?.map((profile) => profile.username));
  const conflicts = rows
    .filter((row) => taken.has(row.username))
    .map((row) => ({ line: row.line, message: `帳號「${row.username}」已有人使用。` }));
  if (conflicts.length > 0) return { errors: conflicts };

  const created: Credential[] = [];
  const failed: RowError[] = [];
  const classId = String(formData.get("classId") ?? "");

  // 逐筆建立：Supabase Auth 沒有批次 API，也避免觸發速率限制。
  for (const row of rows) {
    const result = await createStudentAccount(admin, row);
    if (result.ok) {
      created.push({
        displayName: row.displayName,
        username: row.username,
        password: result.password,
      });
      if (classId) {
        const { error } = await admin
          .from("student_classes")
          .insert({ student_id: result.id, class_id: classId });
        if (error) failed.push({ line: row.line, message: "帳號已建立，但加入班級失敗。" });
      }
    } else {
      failed.push({ line: row.line, message: `「${row.username}」建立失敗。` });
    }
  }

  revalidatePath("/teacher", "layout");
  return { created, failed };
}

export type UpdateStudentState = { error?: string; saved?: boolean };

export async function updateStudent(
  studentId: string,
  _: UpdateStudentState,
  formData: FormData,
): Promise<UpdateStudentState> {
  await requireTeacher();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!isValidDisplayName(displayName)) return { error: "姓名需為 1–50 字。" };
  if (!isValidUsername(username)) return { error: `帳號格式不正確。${USERNAME_HINT}。` };

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("profiles")
    .select("username")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();
  if (!current) return { error: "找不到這位學生。" };

  if (current.username !== username) {
    const { data: duplicate } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (duplicate) return { error: "這個帳號已有人使用。" };

    const { error } = await admin.auth.admin.updateUserById(studentId, {
      email: toAuthEmail(username),
      email_confirm: true,
    });
    if (error) return { error: "帳號更新失敗，請稍後再試。" };
  }

  const { error } = await admin
    .from("profiles")
    .update({ display_name: displayName, username })
    .eq("id", studentId);
  if (error) {
    if (current.username !== username) {
      await admin.auth.admin.updateUserById(studentId, {
        email: toAuthEmail(current.username),
        email_confirm: true,
      });
    }
    return { error: "更新失敗，請稍後再試。" };
  }

  revalidatePath("/teacher", "layout");
  return { saved: true };
}

export type ResetPasswordState = { error?: string; password?: string };

export async function resetStudentPassword(studentId: string): Promise<ResetPasswordState> {
  await requireTeacher();

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("profiles")
    .select("id")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();
  if (!student) return { error: "找不到這位學生。" };

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(studentId, { password });
  if (error) return { error: "重設失敗，請稍後再試。" };
  return { password };
}

export async function toggleStudentActive(studentId: string, active: boolean) {
  await requireTeacher();
  const ok = await setStudentActive(createAdminClient(), studentId, active);
  if (!ok) redirect(`/teacher/students/${studentId}?error=status`);
  revalidatePath("/teacher", "layout");
}
