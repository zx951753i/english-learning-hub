import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * 使用 secret key，會略過 RLS。
 * 只能在已通過 requireTeacher() 的伺服器流程中使用。
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("缺少環境變數 SUPABASE_SECRET_KEY。");
  return createClient(supabaseUrl(), secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
