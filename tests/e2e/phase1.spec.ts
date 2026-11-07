import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const teacher = {
  username: process.env.E2E_TEACHER_USERNAME!,
  password: process.env.E2E_TEACHER_PASSWORD!,
};
const run = Date.now().toString(36);
const amy = { name: `測試Amy${run}`, username: `amy${run}` };
const ben = { name: `測試Ben${run}`, username: `ben${run}` };
const className = `測試國小班${run}`;

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("帳號").fill(username);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入" }).click();
}

async function loginTeacher(page: Page) {
  await login(page, teacher.username, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
}

const alertOn = (page: Page) => page.locator('main [role="alert"]');

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe.serial("Phase 1 主要流程", () => {
  let amyPassword = "";
  let benPassword = "";
  let classUrl = "";

  test("未登入者會被導向登入頁，受保護路徑都進不去", async ({ page }) => {
    for (const path of ["/", "/home", "/teacher", "/teacher/students"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("錯誤密碼顯示訊息", async ({ page }) => {
    await login(page, teacher.username, "wrong-password");
    await expect(alertOn(page)).toContainText("帳號或密碼不正確");
    await expect(page).toHaveURL(/\/login/);
  });

  test("老師建立班級與學生", async ({ page }) => {
    await loginTeacher(page);
    await expect(page).toHaveURL(/\/teacher$/);

    await page.goto("/teacher/classes/new");
    await page.getByLabel("班級名稱").fill(className);
    await page.getByLabel("學習階段").selectOption({ label: "English Kids" });
    await page.getByRole("button", { name: "建立班級" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes\/[0-9a-f-]{36}$/);
    classUrl = page.url();

    await page.goto("/teacher/students/new");
    await page.getByLabel("姓名或暱稱").fill(amy.name);
    await page.getByLabel("帳號").fill(amy.username);
    await page.getByLabel("加入班級（選填）").selectOption({ label: className });
    await page.getByRole("button", { name: "建立學生" }).click();
    const row = page.getByRole("row", { name: new RegExp(amy.username) });
    await expect(row).toBeVisible();
    amyPassword = (await row.getByRole("cell").nth(2).innerText()).trim();
    expect(amyPassword.length).toBeGreaterThanOrEqual(8);

    await page.getByLabel("姓名或暱稱").fill("重複");
    await page.getByLabel("帳號").fill(amy.username);
    await page.getByRole("button", { name: "建立學生" }).click();
    await expect(alertOn(page)).toContainText("已有人使用");
  });

  test("CSV 批次建立：錯誤檔案不建立帳號，正確檔案會建立", async ({ page }) => {
    await loginTeacher(page);
    await page.goto("/teacher/students/import");

    await page.getByLabel("CSV 檔案").setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`姓名,帳號\n${ben.name},${amy.username}\n`),
    });
    await page.getByRole("button", { name: "開始建立" }).click();
    await expect(alertOn(page)).toContainText("沒有建立任何帳號");

    await page.getByLabel("CSV 檔案").setInputFiles({
      name: "ok.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`﻿姓名,帳號,密碼\r\n${ben.name},${ben.username},\r\n`),
    });
    await page.getByRole("button", { name: "開始建立" }).click();
    const row = page.getByRole("row", { name: new RegExp(ben.username) });
    await expect(row).toBeVisible();
    benPassword = (await row.getByRole("cell").nth(2).innerText()).trim();

    await page.goto("/teacher");
    await expect(page.getByRole("link", { name: new RegExp(ben.name) })).toBeVisible();
  });

  test("學生只看到自己的班級，也進不了老師後台", async ({ page }) => {
    await login(page, amy.username, amyPassword);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(amy.name);
    await expect(page.getByText("已開放・0 / 0 關")).toHaveCount(1);
    await expect(page.getByText("尚未開放")).toHaveCount(2);
    await expect(page.getByText("老師正在準備關卡，很快就能出發。")).toBeVisible();

    await page.goto("/teacher/students");
    await expect(page).toHaveURL(/\/home$/);
    expect(await noHorizontalScroll(page)).toBe(true);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/home$/);
  });

  test("學生直接呼叫資料庫 API 也讀不到別人的資料，也改不了角色", async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase.auth.signInWithPassword({
      email: `${amy.username}@accounts.english-learning-hub.invalid`,
      password: amyPassword,
    });
    expect(data.user).toBeTruthy();

    const { data: profiles } = await supabase.from("profiles").select("username");
    expect(profiles).toEqual([{ username: amy.username }]);

    const { error } = await supabase
      .from("profiles")
      .update({ role: "teacher" })
      .eq("id", data.user!.id);
    expect(error?.code).toBe("42501");

    const { data: classes } = await supabase.from("classes").select("name");
    expect(classes).toEqual([{ name: className }]);
  });

  test("重設密碼後舊密碼失效", async ({ page, browser }) => {
    await loginTeacher(page);
    await page.goto("/teacher/students");
    await page.getByRole("link", { name: new RegExp(amy.username) }).click();
    await page.getByRole("button", { name: "產生新密碼" }).click();
    const row = page.getByRole("row", { name: new RegExp(amy.username) });
    await expect(row).toBeVisible();
    const newPassword = (await row.getByRole("cell").nth(2).innerText()).trim();

    const student = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
    await login(student, amy.username, amyPassword);
    await expect(alertOn(student)).toBeVisible();
    await login(student, amy.username, newPassword);
    await expect(student).toHaveURL(/\/home$/);
    amyPassword = newPassword;
  });

  test("停用立即生效，連已登入的學生也會被登出；恢復後可再登入", async ({ page, browser }) => {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const student = await context.newPage();
    await login(student, amy.username, amyPassword);
    await expect(student).toHaveURL(/\/home$/);

    await loginTeacher(page);
    await page.goto("/teacher/students");
    await page.getByRole("link", { name: new RegExp(amy.username) }).click();
    await expect(page).toHaveURL(/students\/[0-9a-f-]{36}$/);
    const detail = page.url();
    await page.getByRole("button", { name: "停用帳號" }).click();
    await expect(page.getByRole("button", { name: "恢復帳號" })).toBeVisible();

    await student.reload();
    await expect(student).toHaveURL(/\/login$/);

    await login(student, amy.username, amyPassword);
    await expect(alertOn(student)).toBeVisible();

    await page.goto(detail);
    await page.getByRole("button", { name: "恢復帳號" }).click();
    await expect(page.getByRole("button", { name: "停用帳號" })).toBeVisible();

    await student.goto("/home");
    await expect(student).toHaveURL(/\/home$/);
  });

  test("修改帳號後用新帳號登入", async ({ page, browser }) => {
    await loginTeacher(page);
    await page.goto("/teacher/students");
    await page.getByRole("link", { name: new RegExp(ben.username) }).click();
    const renamed = `${ben.username}x`;
    await page.getByLabel("帳號").fill(renamed);
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByRole("status")).toContainText("已儲存");

    const student = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
    await login(student, renamed, benPassword);
    await expect(student).toHaveURL(/\/home$/);
  });

  test("班級成員、移出與封存", async ({ page, browser }) => {
    await loginTeacher(page);
    await page.goto(classUrl);
    await expect(page.getByRole("heading", { name: /班級成員（1）/ })).toBeVisible();

    await page.getByRole("checkbox", { name: new RegExp(ben.name) }).check();
    await page.getByRole("button", { name: "加入所選學生" }).click();
    await expect(page.getByRole("heading", { name: /班級成員（2）/ })).toBeVisible();

    await page.getByRole("button", { name: `將 ${ben.name} 移出班級` }).click();
    await expect(page.getByRole("heading", { name: /班級成員（1）/ })).toBeVisible();

    await page.getByRole("checkbox", { name: new RegExp(ben.name) }).check();
    await page.getByRole("button", { name: "加入所選學生" }).click();
    await expect(page.getByRole("heading", { name: /班級成員（2）/ })).toBeVisible();

    await page.getByRole("button", { name: "封存班級" }).click();
    await expect(page.getByRole("button", { name: "恢復班級" })).toBeVisible();

    const student = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
    await login(student, amy.username, amyPassword);
    await expect(student.getByText("老師還沒有把您加入班級")).toBeVisible();

    await page.getByRole("button", { name: "恢復班級" }).click();
    await expect(page.getByRole("button", { name: "封存班級" })).toBeVisible();
    await student.reload();
    await expect(student.getByText("已開放・0 / 0 關")).toBeVisible();
  });

  test("登出後回到登入頁", async ({ page }) => {
    await loginTeacher(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "登出" }).last().click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/teacher");
    await expect(page).toHaveURL(/\/login$/);
  });
});
