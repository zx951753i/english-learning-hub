function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`缺少環境變數 ${name}，請檢查 .env.local 或 Vercel 設定。`);
  return value;
}

// NEXT_PUBLIC_ 變數必須完整寫出，打包工具才會替換。
export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = () =>
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
