"use server";

import { revalidatePath } from "next/cache";
import { isAvatar } from "@/features/adventure/rules";
import { requireStudent } from "@/features/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/** 學生只能改自己的頭像，且只能選清單內的值；其他欄位一律不經這裡。 */
export async function chooseAvatar(avatar: string) {
  const profile = await requireStudent();
  if (!isAvatar(avatar)) return;
  await createAdminClient().from("profiles").update({ avatar_key: avatar }).eq("id", profile.id).eq("role", "student");
  revalidatePath("/home");
}
