import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: "teacher" | "student";
  display_name: string;
  username: string;
  is_active: boolean;
};

/** 同一次請求只查一次。RLS 會讓停用帳號查不到資料。 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, display_name, username, is_active")
    .eq("id", userId)
    .maybeSingle();

  return data?.is_active ? (data as Profile) : null;
});

export const homePathFor = (role: Profile["role"]) => (role === "teacher" ? "/teacher" : "/home");

export async function requireTeacher(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher") redirect(homePathFor(profile.role));
  return profile;
}

export async function requireStudent(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "student") redirect(homePathFor(profile.role));
  return profile;
}
