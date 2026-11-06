import { expect, test, type Browser, type Page } from "@playwright/test";

const teacher = {
  username: process.env.E2E_TEACHER_USERNAME!,
  password: process.env.E2E_TEACHER_PASSWORD!,
};
const run = Date.now().toString(36);
const book = `遊戲教材${run}`;
const className = `遊戲班${run}`;
const student = { name: `遊戲學生${run}`, username: `gm${run}`, password: "Playtest1234" };
const outsider = { name: `班外學生${run}`, username: `out${run}`, password: "Playtest1234" };
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const image = `cat${run}.png`;

async function login(page: Page, username: string, password: string, url: RegExp) {
  await page.goto("/login");
  await page.getByLabel("帳號").fill(username);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(url);
}
const loginTeacher = (page: Page) => login(page, teacher.username, teacher.password, /\/teacher$/);

async function studentPage(browser: Browser, who = student) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await login(page, who.username, who.password, /\/home$/);
  return page;
}

async function importCsv(page: Page, type: string, csv: string) {
  await page.goto("/teacher/questions/import");
  await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: book });
  await page.getByLabel("題目類型").selectOption({ label: type });
  await page.getByLabel("Excel 或 CSV 檔案").setInputFiles({
    name: "q.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "上傳並預覽" }).click();
  await expect(page.getByText(/有問題 0 列/)).toBeVisible();
  await page.getByLabel("題目來源").selectOption({ label: "老師原創" });
  await page.getByLabel("我已確認這批題目與答案，匯入後直接開放使用").check();
  await page.getByRole("button", { name: /確認匯入/ }).click();
  await expect(page.getByText(/已匯入 \d+ 題/)).toBeVisible();
}

async function createGame(page: Page, type: string, title: string) {
  await page.goto("/teacher/games/new");
  await page.getByLabel("遊戲類型").selectOption({ label: type });
  await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: book });
  await page.getByRole("combobox", { name: /^單元/ }).selectOption({ label: "Unit 1" });
  await page.getByLabel("遊戲名稱").fill(title);
  await page.getByRole("button", { name: "建立遊戲" }).click();
  await expect(page).toHaveURL(/games\/[0-9a-f-]{36}$/);
}

test.describe.serial("Phase 3 遊戲", () => {
  test.beforeEach(async ({ page }) => loginTeacher(page));

  test("媒體庫：上傳圖片，拒絕偽裝檔案", async ({ page }) => {
    await page.goto("/teacher/media");
    const input = page.getByLabel("選擇圖片（可多選）");
    await input.setInputFiles({ name: image, mimeType: "image/png", buffer: png });
    await expect(page.getByText("已上傳 1 張圖片")).toBeVisible();
    await expect(page.getByText(image)).toBeVisible();

    await input.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<svg/>") });
    await expect(page.locator('main [role="alert"]')).toContainText("不是 PNG");
  });

  test("準備教材、題目、班級與學生", async ({ page }) => {
    await page.goto("/teacher/textbooks/new");
    await page.getByLabel("學習階段").selectOption({ label: "English Kids" });
    await page.getByLabel("教材名稱").fill(book);
    await page.getByLabel("先建立幾個單元").fill("1");
    await page.getByRole("button", { name: "建立教材" }).click();
    await expect(page.getByRole("heading", { name: "單元（1）" })).toBeVisible();

    await importCsv(
      page,
      "單字",
      `﻿單元,難度,英文單字,中文意思,圖片\r\nUnit 1,1,cat,貓,${image}\r\nUnit 1,1,dog,狗,\r\nUnit 1,1,hat,帽子,\r\nUnit 1,1,bag,包包,\r\n`,
    );
    await importCsv(
      page,
      "自然發音",
      "﻿單元,難度,字母或字母組合,發音,例字\r\nUnit 1,1,a,/æ/,cat\r\nUnit 1,1,b,/b/,bag\r\nUnit 1,1,sh,/ʃ/,ship\r\n",
    );

    for (const who of [student, outsider]) {
      await page.goto("/teacher/students/new");
      await page.getByLabel("姓名或暱稱").fill(who.name);
      await page.getByLabel("帳號").fill(who.username);
      await page.getByLabel("密碼（選填）").fill(who.password);
      await page.getByRole("button", { name: "建立學生" }).click();
      await expect(page.getByRole("row", { name: new RegExp(who.username) })).toBeVisible();
    }

    await page.goto("/teacher/classes/new");
    await page.getByLabel("班級名稱").fill(className);
    await page.getByLabel("學習階段").selectOption({ label: "English Kids" });
    await page.getByRole("button", { name: "建立班級" }).click();
    await expect(page).toHaveURL(/classes\/[0-9a-f-]{36}$/);
    await page.getByRole("checkbox", { name: new RegExp(student.name) }).check();
    await page.getByRole("button", { name: "加入所選學生" }).click();
    await expect(page.getByRole("heading", { name: /班級成員（1）/ })).toBeVisible();
    await page.getByLabel("選擇教材").selectOption({ label: book });
    await page.getByRole("button", { name: "授權", exact: true }).click();
    await expect(page.getByRole("heading", { name: "授權教材（1）" })).toBeVisible();
  });

  test("Game Builder：計算可用題目、試玩不計入紀錄、發布", async ({ page }) => {
    await createGame(page, "Word Spelling", `拼字${run}`);
    await expect(page.getByText("可用題目 4 題")).toBeVisible();
    await page.getByRole("button", { name: "試玩" }).click();
    await expect(page).toHaveURL(/play\/[0-9a-f-]{36}$/);
    for (let i = 0; i < 4; i += 1) {
      await page.getByLabel(/拼出單字/).fill("zzz");
      await page.getByRole("button", { name: "送出答案" }).click();
      await page.getByRole("button", { name: /下一題|看成績/ }).click();
    }
    await expect(page.getByText("這是老師試玩")).toBeVisible();
    await expect(page.getByText("答對 0 / 4 題")).toBeVisible();

    await page.goto("/teacher/games");
    await page.getByRole("link", { name: new RegExp(`拼字${run}`) }).click();
    await page.getByRole("button", { name: "發布給學生" }).click();
    await expect(page.getByRole("button", { name: "取消發布" })).toBeVisible();

    await createGame(page, "Listen and Choose", `聽力${run}`);
    await page.getByRole("button", { name: "發布給學生" }).click();
    await expect(page.getByRole("button", { name: "取消發布" })).toBeVisible();

    await createGame(page, "Alphabet Matching", `字母${run}`);
    await expect(page.getByText("可用題目 2 題")).toBeVisible();
    await page.getByRole("button", { name: "發布給學生" }).click();
    await expect(page.getByRole("button", { name: "取消發布" })).toBeVisible();

    await createGame(page, "Word Spelling", `草稿${run}`);
  });

  test("班外學生與未發布遊戲都看不到", async ({ browser }) => {
    const page = await studentPage(browser, outsider);
    await expect(page.getByText(`拼字${run}`)).toHaveCount(0);
    const mine = await studentPage(browser);
    await expect(mine.getByText(`拼字${run}`)).toBeVisible();
    await expect(mine.getByText(`草稿${run}`)).toHaveCount(0);
  });

  test("Word Spelling：批改、回饋、成績、只練錯題；答案不外流", async ({ browser }) => {
    const page = await studentPage(browser);
    const payloads: string[] = [];
    page.on("response", async (response) => {
      if (response.url().includes("/play/")) payloads.push(await response.text().catch(() => ""));
    });
    await page.getByRole("button", { name: `開始 拼字${run}` }).click();
    await expect(page).toHaveURL(/play\/[0-9a-f-]{36}$/);
    const html = await page.content();
    expect(html).not.toContain("grading");
    expect(html).not.toContain("answer_key");

    const answers: Record<string, string> = { 貓: "cat", 狗: "dog", 帽子: "hat", 包包: "bag" };
    let wrongLeft = 1;
    for (let i = 0; i < 4; i += 1) {
      const prompt = await page.locator("p.text-2xl").innerText();
      const value = wrongLeft > 0 ? "wrong" : ` ${answers[prompt].toUpperCase()} `;
      await page.getByLabel(/拼出單字/).fill(value);
      await page.getByRole("button", { name: "送出答案" }).click();
      if (wrongLeft > 0) {
        await expect(page.getByText("再接再厲")).toBeVisible();
        await expect(page.getByText(`正確答案：${answers[prompt]}`)).toBeVisible();
        wrongLeft -= 1;
      } else {
        await expect(page.getByText("答對了！")).toBeVisible();
      }
      await page.getByRole("button", { name: /下一題|看成績/ }).click();
    }

    await expect(page).toHaveURL(/result$/);
    await expect(page.getByText("答對 3 / 4 題")).toBeVisible();
    await expect(page.getByText("75", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "只練錯題" }).click();
    await expect(page.getByText("第 1 / 1 題")).toBeVisible();
    const prompt = await page.locator("p.text-2xl").innerText();
    await page.getByLabel(/拼出單字/).fill(answers[prompt]);
    await page.getByRole("button", { name: "送出答案" }).click();
    await page.getByRole("button", { name: "看成績" }).click();
    await expect(page.getByText("答對 1 / 1 題")).toBeVisible();

    await page.getByRole("button", { name: "重新挑戰" }).click();
    await expect(page.getByText("第 1 / 4 題")).toBeVisible();
    await page.goto("/home");
    await expect(page.getByRole("link", { name: new RegExp(`拼字${run}`) }).first()).toBeVisible();
  });

  test("中途離開可接續，不重複計分", async ({ browser }) => {
    const page = await studentPage(browser);
    await page.getByRole("button", { name: `開始 拼字${run}` }).click();
    await expect(page.getByText("第 1 / 4 題")).toBeVisible();
    await page.getByLabel(/拼出單字/).fill("x");
    await page.getByRole("button", { name: "送出答案" }).click();
    await expect(page.getByText("再接再厲")).toBeVisible();
    await page.reload();
    await expect(page.getByText("第 2 / 4 題")).toBeVisible();
  });

  test("別人的遊戲頁面打不開", async ({ browser }) => {
    const page = await studentPage(browser);
    await page.getByRole("button", { name: `開始 拼字${run}` }).click();
    await expect(page).toHaveURL(/play\/[0-9a-f-]{36}$/);
    const url = page.url();
    const other = await studentPage(browser, outsider);
    await other.goto(url);
    await expect(other.getByText("找不到這個頁面")).toBeVisible();
  });

  test("Listen and Choose：顯示圖片選項並可完成", async ({ browser }) => {
    const page = await studentPage(browser);
    await page.getByRole("button", { name: `開始 聽力${run}` }).click();
    await expect(page.getByRole("button", { name: "聽發音" })).toBeVisible();
    await expect(page.getByRole("img", { name: "貓" })).toBeVisible();
    await expect
      .poll(() => page.getByRole("img", { name: "貓" }).evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    for (let i = 0; i < 4; i += 1) {
      await page.locator("button[aria-pressed]").first().click();
      await page.getByRole("button", { name: /下一題|看成績/ }).click();
    }
    await expect(page).toHaveURL(/result$/);
    await expect(page.getByText(/答對 \d \/ 4 題/)).toBeVisible();
  });

  test("Alphabet Matching：配對大小寫", async ({ browser }) => {
    const page = await studentPage(browser);
    await page.getByRole("button", { name: `開始 字母${run}` }).click();
    await page.getByRole("button", { name: "大寫 A" }).click();
    await page.getByRole("button", { name: "小寫 a" }).click();
    await expect(page.getByRole("button", { name: "大寫 A" })).toBeDisabled();
    await page.getByRole("button", { name: "大寫 B" }).click();
    await page.getByRole("button", { name: "小寫 b" }).click();
    await page.getByRole("button", { name: "看成績" }).click();
    await expect(page.getByText("答對 2 / 2 題")).toBeVisible();
  });

  test("老師看得到學生作答數量，使用中的圖片不能刪除", async ({ page }) => {
    await page.goto("/teacher/media");
    await page.getByRole("button", { name: `刪除 ${image}` }).click();
    await expect(page.locator('main [role="alert"]')).toContainText("還有題目在使用");
  });
});
