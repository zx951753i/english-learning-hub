import { expect, test, type Page } from "@playwright/test";
import readXlsx from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";

const teacher = {
  username: process.env.E2E_TEACHER_USERNAME!,
  password: process.env.E2E_TEACHER_PASSWORD!,
};
const run = Date.now().toString(36);
const bookTitle = `測試教材${run}`;
const word = `word${run}`;

async function loginTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel("帳號").fill(teacher.username);
  await page.getByLabel("密碼").fill(teacher.password);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
}

const alertOn = (page: Page) => page.locator('main [role="alert"]');
const rowFor = (page: Page, text: string) =>
  page.locator("div").filter({ has: page.getByRole("link", { name: new RegExp(text) }) }).last();

test.describe.serial("Phase 2 教材與題庫", () => {
  test.beforeEach(async ({ page }) => loginTeacher(page));

  test("建立教材時自動產生單元，可改名與調整順序", async ({ page }) => {
    await page.goto("/teacher/textbooks/new");
    await page.getByLabel("學習階段").selectOption({ label: "English Kids" });
    await page.getByLabel("教材名稱").fill(bookTitle);
    await page.getByLabel("先建立幾個單元").fill("3");
    await page.getByRole("button", { name: "建立教材" }).click();
    await expect(page).toHaveURL(/textbooks\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "單元（3）" })).toBeVisible();

    await page.getByRole("button", { name: "將 Unit 2 上移" }).click();
    await expect(page.locator("ol > li").first()).toContainText("Unit 2");
    await page.getByRole("button", { name: "將 Unit 2 下移" }).click();
    await expect(page.locator("ol > li").first()).toContainText("Unit 1");

    await page.getByLabel("新增單元").fill("Review");
    await page.getByRole("button", { name: "新增", exact: true }).click();
    await expect(page.getByRole("heading", { name: "單元（4）" })).toBeVisible();
  });

  test("單元可建立主題與文章", async ({ page }) => {
    await page.goto("/teacher/textbooks");
    await page.getByRole("link", { name: new RegExp(bookTitle) }).click();
    await page.getByRole("link", { name: /Unit 1/ }).click();
    await expect(page).toHaveURL(/units\/[0-9a-f-]{36}$/);

    await page.getByLabel("主題名稱").fill("Animals");
    await page.getByLabel("技能類別").selectOption({ label: "單字" });
    await page.getByLabel("概念標籤（選填）").fill("animals, nouns");
    await page.getByRole("button", { name: "新增主題" }).click();
    await expect(page.getByRole("heading", { name: "主題（1）" })).toBeVisible();

    await page.getByLabel("文章標題").fill("My Pet");
    await page.getByLabel("文章內容").fill("I have a cat.");
    await page.getByLabel("內容來源").selectOption({ label: "老師原創" });
    await page.getByRole("button", { name: "新增文章" }).click();
    await expect(page.getByRole("heading", { name: "閱讀文章（1）" })).toBeVisible();
  });

  test("題目編輯器：驗證、儲存、編輯後再啟用", async ({ page }) => {
    await page.goto("/teacher/questions/new");
    await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: bookTitle });
    await page.getByRole("combobox", { name: /^單元/ }).selectOption({ label: "Unit 1" });
    await page.getByLabel("主題（選填）").selectOption({ label: "Animals" });
    await page.getByLabel("題目類型").selectOption({ label: "選擇題" });
    await page.getByLabel("題幹").fill(`Stem ${word}`);
    await page.getByLabel("選項 A", { exact: true }).fill("cat");
    await page.getByLabel("選項 B", { exact: true }).fill("dog");
    await page.getByLabel("正確答案").selectOption("C");
    await page.getByLabel("連結文章（選填）").selectOption({ label: "My Pet" });
    await page.getByLabel("難度").selectOption({ label: "Level 2" });
    await page.getByLabel("題目來源").selectOption({ label: "老師原創" });
    await page.getByRole("button", { name: "儲存題目" }).click();
    await expect(alertOn(page)).toContainText("正確答案必須是已填寫的選項");

    await page.getByLabel("正確答案").selectOption("B");
    await page.getByRole("button", { name: "儲存題目" }).click();
    await expect(page).toHaveURL(/questions\?saved=1/);
    await expect(page.locator("main span", { hasText: "待確認" }).first()).toBeVisible();

    await page.getByRole("link", { name: new RegExp(`Stem ${word}`) }).click();
    await expect(page.getByLabel("題幹")).toHaveValue(`Stem ${word}`);
    await expect(page.getByLabel("正確答案")).toHaveValue("B");
    await expect(page.getByLabel("連結文章（選填）")).not.toHaveValue("");
    await page.getByLabel("我已確認題目與答案，可開放使用").check();
    await page.getByRole("button", { name: "儲存題目" }).click();
    await expect(page).toHaveURL(/questions\?saved=1/);
    await expect(rowFor(page, `Stem ${word}`).locator("span", { hasText: "啟用中" }).first()).toBeVisible();
  });

  test("儲存並新增下一題會保留位置、清空內容", async ({ page }) => {
    await page.goto("/teacher/questions/new");
    await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: bookTitle });
    await page.getByRole("combobox", { name: /^單元/ }).selectOption({ label: "Unit 2" });
    await page.getByLabel("英文單字").fill(`next${run}`);
    await page.getByLabel("中文意思").fill("下一題");
    await page.getByLabel("難度").selectOption({ label: "Level 1" });
    await page.getByLabel("題目來源").selectOption({ label: "老師提供的資料" });
    await page.getByRole("button", { name: "儲存並新增下一題" }).click();
    await expect(page.getByText("已儲存，可繼續新增下一題")).toBeVisible();
    await expect(page.getByLabel("英文單字")).toHaveValue("");
    await expect(page.getByRole("combobox", { name: /^單元/ })).not.toHaveValue("");
    await expect(page.getByLabel("難度")).toHaveValue("1");
  });

  test("Excel 範本可下載，且欄位正確", async ({ page }) => {
    const response = await page.request.get("/teacher/questions/import/template/vocab_item");
    expect(response.status()).toBe(200);
    const sheets = await readXlsx(Buffer.from(await response.body()));
    expect(sheets[0].data[0]).toEqual(
      expect.arrayContaining(["單元", "難度", "英文單字", "中文意思", "中文解析"]),
    );
  });

  test("Excel 匯入：預覽錯誤列，確認後只匯入正確的題目，不可重複匯入", async ({ page }) => {
    const buffer = await writeExcelFile([
      ["單元", "難度", "英文單字", "中文意思"].map((value) => ({ value })),
      [`Unit 1`, 1, `xl${run}a`, "甲"].map((value) => ({ value })),
      [`Unit 2`, "Level 2", `xl${run}b`, "乙"].map((value) => ({ value })),
      [`Unit 99`, 1, `xl${run}c`, "丙"].map((value) => ({ value })),
    ]).toBuffer();

    await page.goto("/teacher/questions/import");
    await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: bookTitle });
    await page.getByLabel("Excel 或 CSV 檔案").setInputFiles({
      name: "questions.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(buffer),
    });
    await page.getByRole("button", { name: "上傳並預覽" }).click();
    await expect(page.getByText("可匯入 2 題，有問題 1 列")).toBeVisible();
    await expect(alertOn(page)).toContainText("第 4 列");
    await expect(alertOn(page)).toContainText("Unit 99");
    const preview = page.url();

    await page.getByLabel("題目來源").selectOption({ label: "老師提供的資料" });
    await page.getByRole("button", { name: "確認匯入 2 題" }).click();
    await expect(page.getByText("已匯入 2 題")).toBeVisible();

    await page.goto(`/teacher/questions?q=xl${run}`);
    await expect(page.getByText("共 2 題")).toBeVisible();
    await expect(page.locator("main span", { hasText: "待確認" }).first()).toBeVisible();

    await page.goto(preview);
    await expect(page.getByText("這批題目已匯入")).toBeVisible();
    await expect(page.getByRole("button", { name: /確認匯入/ })).toHaveCount(0);
  });

  test("CSV 匯入與取消", async ({ page }) => {
    await page.goto("/teacher/questions/import");
    await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: bookTitle });
    await page.getByLabel("題目類型").selectOption({ label: "克漏字" });
    await page.getByLabel("Excel 或 CSV 檔案").setInputFiles({
      name: "cloze.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`﻿單元,難度,短文,各格答案\r\nUnit 1,1,I ___ a cat ${run}.,have\r\n`),
    });
    await page.getByRole("button", { name: "上傳並預覽" }).click();
    await expect(page.getByText("可匯入 1 題，有問題 0 列")).toBeVisible();
    await page.getByRole("button", { name: "取消這次匯入" }).click();
    await expect(page).toHaveURL(/questions\/import$/);
    await page.goto(`/teacher/questions?q=${run}&type=cloze_item`);
    await expect(page.getByText("共 0 題")).toBeVisible();
  });

  test("檔案全部錯誤時不建立預覽，並顯示原因", async ({ page }) => {
    await page.goto("/teacher/questions/import");
    await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: bookTitle });
    await page.getByLabel("Excel 或 CSV 檔案").setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("姓名,帳號\nA,b\n"),
    });
    await page.getByRole("button", { name: "上傳並預覽" }).click();
    await expect(alertOn(page)).toContainText("缺少欄位");
  });

  test("批次確認、篩選、停用與刪除", async ({ page }) => {
    await page.goto(`/teacher/questions?q=xl${run}&status=draft`);
    await expect(page.getByText("共 2 題")).toBeVisible();
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await page.getByRole("button", { name: "確認並啟用" }).click();
    await expect(page.getByText("共 0 題")).toBeVisible();

    await page.goto(`/teacher/questions?q=xl${run}&status=active`);
    await expect(page.getByText("共 2 題")).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "停用", exact: true }).click();
    await expect(page.getByText("共 1 題")).toBeVisible();

    await page.goto(`/teacher/questions?q=xl${run}`);
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "刪除", exact: true }).click();
    await expect(page.getByText("共 1 題")).toBeVisible();
  });

  test("有題目的單元不能刪除；空單元可以刪除", async ({ page }) => {
    await page.goto("/teacher/textbooks");
    await page.getByRole("link", { name: new RegExp(bookTitle) }).click();
    await page.getByRole("link", { name: /Unit 1/ }).click();
    await expect(page.getByRole("button", { name: "刪除單元" })).toHaveCount(0);

    await page.getByRole("link", { name: bookTitle }).click();
    await page.getByRole("link", { name: /Review/ }).click();
    await page.getByRole("button", { name: "刪除單元" }).click();
    await expect(page.getByRole("heading", { name: "單元（3）" })).toBeVisible();
  });
});
