"use server";

import { redirect } from "next/navigation";
import { normalizeUsername, toAuthEmail } from "@/features/accounts/rules";
import { homePathFor } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const LOGIN_FAILED = "帳號或密碼不正確；若持續無法登入，請聯絡老師。";

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "請輸入帳號和密碼。" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(username),
    password,
  });
  if (error || !data.user) return { error: LOGIN_FAILED };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: LOGIN_FAILED };
  }

  redirect(homePathFor(profile.role));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
