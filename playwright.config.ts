import { defineConfig } from "@playwright/test";

// 需要一個可連線的 Supabase 專案，以及環境變數 E2E_TEACHER_USERNAME、E2E_TEACHER_PASSWORD。
// 測試會建立學生與班級，請勿對正式環境執行。
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH || undefined },
  },
});
