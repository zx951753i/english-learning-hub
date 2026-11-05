// 建立第一位老師帳號。整個平台只需要執行一次。
// 用法：node --env-file=.env.local scripts/create-teacher.mjs <帳號> <顯示名稱>
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const AUTH_EMAIL_DOMAIN = "accounts.english-learning-hub.invalid";

const [usernameArg, displayName] = process.argv.slice(2);
const username = usernameArg?.trim().toLowerCase();

if (!username || !displayName) {
  console.error("用法：node --env-file=.env.local scripts/create-teacher.mjs <帳號> <顯示名稱>");
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
  console.error("帳號需為 3–32 字，可用英文、數字、點、底線、連字號。");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("找不到 Supabase 設定，請確認 .env.local 已填寫。");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { count, error: countError } = await admin
  .from("profiles")
  .select("id", { count: "exact", head: true })
  .eq("role", "teacher");
if (countError) {
  console.error(`無法連線資料庫：${countError.message}`);
  process.exit(1);
}
if (count > 0) {
  console.error("已經有老師帳號，不需要再建立。");
  process.exit(1);
}

const password = randomBytes(12).toString("base64url");
const { data, error } = await admin.auth.admin.createUser({
  email: `${username}@${AUTH_EMAIL_DOMAIN}`,
  password,
  email_confirm: true,
});
if (error) {
  console.error(`建立登入帳號失敗：${error.message}`);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").insert({
  id: data.user.id,
  role: "teacher",
  display_name: displayName,
  username,
});
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error(`建立老師資料失敗：${profileError.message}`);
  process.exit(1);
}

console.log("老師帳號已建立，請把密碼存到安全的地方，之後不會再顯示：");
console.log(`帳號：${username}`);
console.log(`密碼：${password}`);
