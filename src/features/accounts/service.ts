import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePassword, toAuthEmail } from "@/features/accounts/rules";

export type CreateStudentResult =
  | { ok: true; id: string; password: string }
  | { ok: false; reason: "duplicate" | "failed" };

/** 建立登入帳號與 profile；任一步失敗都不留下半套帳號。 */
export async function createStudentAccount(
  admin: SupabaseClient,
  input: { displayName: string; username: string; password?: string },
): Promise<CreateStudentResult> {
  const password = input.password || generatePassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: toAuthEmail(input.username),
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    const duplicate = error?.code === "email_exists" || error?.status === 422;
    return { ok: false, reason: duplicate ? "duplicate" : "failed" };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    role: "student",
    display_name: input.displayName,
    username: input.username,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, reason: profileError.code === "23505" ? "duplicate" : "failed" };
  }

  return { ok: true, id: data.user.id, password };
}

/** 停用時先擋資料，再擋登入；停用立即生效，不必等登入憑證過期。 */
export async function setStudentActive(admin: SupabaseClient, id: string, active: boolean) {
  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id)
    .eq("role", "student");
  if (error) return false;

  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  });
  if (authError) {
    await admin.from("profiles").update({ is_active: !active }).eq("id", id);
    return false;
  }
  return true;
}
