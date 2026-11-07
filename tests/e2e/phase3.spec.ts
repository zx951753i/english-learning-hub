import { expect, test } from "@playwright/test";
import { addLevel, alertOn, loginTeacher, openTemplateZone, prepareContent, studentPage } from "./helpers";

const run = Date.now().toString(36);
const book = `遊戲教材${run}`;
const student = { name: `遊戲學生${run}`, username: `gm${run}`, password: "Playtest1234", join: true };
const outsider = { name: `班外學生${run}`, username: `out${run}`, password: "Playtest1234", join: false };
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const image = `cat${run}.png`;
const always = "一律開放";
let villageUrl = "";
let forestUrl = "";

test.describe.serial("Phase 3 遊戲（經由關卡）", () => {
  test.beforeEach(async ({ page }) => loginTeacher(page));

  test("媒體庫：上傳圖片，拒絕偽裝檔案", async ({ page }) => {
    await page.goto("/teacher/media");
    const input = page.getByLabel("選擇圖片或音檔（可多選）");
    await input.setInputFiles({ name: image, mimeType: "image/png", buffer: png });
    await expect(page.getByText("已上傳 1 個檔案")).toBeVisible();
    await input.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<svg/>") });
    await expect(alertOn(page)).toContainText("不是支援的圖片或音檔");
  });

  test("準備教材、題目、班級與區域", async ({ page }) => {
    await prepareContent(page, {
      book,
      className: `遊戲班${run}`,
      students: [student, outsider],
      imports: [
        { type: "單字", csv: `﻿單元,難度,英文單字,中文意思,圖片\r\nUnit 1,1,cat,貓,${image}\r\nUnit 1,1,dog,狗,\r\nUnit 1,1,hat,帽子,\r\nUnit 1,1,bag,包包,\r\n` },
        { type: "自然發音", csv: "﻿單元,難度,字母或字母組合,發音,例字\r\nUnit 1,1,a,/æ/,cat\r\nUnit 1,1,b,/b/,bag\r\nUnit 1,1,sh,/ʃ/,ship\r\n" },
      ],
    });
    await openTemplateZone(page, book, "Vocabulary Village");
    villageUrl = page.url();
    await page.getByRole("link", { name: book }).click();
    await expect(page.getByRole("link", { name: book, exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: /Alphabet Forest/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Alphabet Forest" })).toBeVisible();
    forestUrl = page.url();
  });

  test("Level Builder：可用題目、試玩不計入紀錄、發布", async ({ page }) => {
    const url = await addLevel(page, villageUrl, { type: "Word Spelling", title: `拼字${run}`, unlock: always, publish: false });
    await expect(page.getByText("可用題目 4 題")).toBeVisible();
    await page.getByRole("button", { name: "試玩" }).click();
    for (let i = 0; i < 4; i += 1) {
      await page.getByLabel(/拼出單字/).fill("zzz");
      await page.getByRole("button", { name: "送出答案" }).click();
      await page.getByRole("button", { name: /下一題|看成績/ }).click();
    }
    await expect(page.getByText("這是老師試玩")).toBeVisible();
    await page.goto(url);
    await page.getByRole("button", { name: "發布到地圖" }).click();
    await expect(page.getByRole("button", { name: "取消發布" })).toBeVisible();

    await addLevel(page, villageUrl, { type: "Listen and Choose", title: `聽力${run}`, unlock: always });
    await addLevel(page, forestUrl, { type: "Alphabet Matching", title: `字母${run}` });
    await expect(page.getByText("可用題目 2 題")).toBeVisible();
    await addLevel(page, villageUrl, { type: "Word Spelling", title: `草稿${run}`, unlock: always, publish: false });
  });

  test("班外學生看不到；班上學生看不到未發布關卡", async ({ browser, baseURL }) => {
    const other = await studentPage(browser, baseURL, outsider);
    await expect(other.getByText("尚未開放").first()).toBeVisible();
    const mine = await studentPage(browser, baseURL, student);
    await mine.goto(villageUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/"));
    await expect(mine.getByRole("button", { name: new RegExp(`拼字${run}`) })).toBeVisible();
    await expect(mine.getByText(`草稿${run}`)).toHaveCount(0);
  });

  test("Word Spelling：批改、回饋、成績、只練錯題；答案不外流", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, student);
    await page.goto(villageUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/"));
    await page.getByRole("button", { name: new RegExp(`拼字${run}`) }).click();
    await expect(page).toHaveURL(/play\/[0-9a-f-]{36}$/);
    const html = await page.content();
    expect(html).not.toContain("grading");
    expect(html).not.toContain("answer_key");

    const answers: Record<string, string> = { 貓: "cat", 狗: "dog", 帽子: "hat", 包包: "bag" };
    for (let i = 0; i < 4; i += 1) {
      const prompt = await page.locator("p.text-2xl").innerText();
      await page.getByLabel(/拼出單字/).fill(i === 0 ? "wrong" : ` ${answers[prompt].toUpperCase()} `);
      await page.getByRole("button", { name: "送出答案" }).click();
      await expect(page.getByText(i === 0 ? "再接再厲" : "答對了！")).toBeVisible();
      await page.getByRole("button", { name: /下一題|看成績/ }).click();
    }
    await expect(page).toHaveURL(/result$/);
    await expect(page.getByText("答對 3 / 4 題")).toBeVisible();
    await expect(page.getByRole("img", { name: "獲得 2 顆星，共 3 顆" })).toBeVisible();

    await page.getByRole("button", { name: "只練錯題" }).click();
    await expect(page.getByText("第 1 / 1 題")).toBeVisible();
    const prompt = await page.locator("p.text-2xl").innerText();
    await page.getByLabel(/拼出單字/).fill(answers[prompt]);
    await page.getByRole("button", { name: "送出答案" }).click();
    await page.getByRole("button", { name: "看成績" }).click();
    await expect(page.getByText("只練錯題不改變關卡星數")).toBeVisible();

    await page.getByRole("button", { name: "再挑戰一次" }).click();
    await expect(page.getByText("第 1 / 4 題")).toBeVisible();
  });

  test("中途離開可接續；別人的遊戲頁面打不開", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, student);
    await page.goto(villageUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/"));
    await page.getByRole("button", { name: new RegExp(`拼字${run}`) }).click();
    await page.getByLabel(/拼出單字/).fill("x");
    await page.getByRole("button", { name: "送出答案" }).click();
    await expect(page.getByText("再接再厲")).toBeVisible();
    await page.reload();
    await expect(page.getByText("第 2 / 4 題")).toBeVisible();
    const other = await studentPage(browser, baseURL, outsider);
    await other.goto(page.url());
    await expect(other.getByText("找不到這個頁面")).toBeVisible();
  });

  test("Listen and Choose 與 Alphabet Matching", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, student);
    await page.goto(villageUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/"));
    await page.getByRole("button", { name: new RegExp(`聽力${run}`) }).click();
    await expect(page.getByRole("button", { name: "聽發音" })).toBeVisible();
    await expect(page.getByRole("img", { name: "貓" })).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      await page.locator("button[aria-pressed]").first().click();
      await page.getByRole("button", { name: /下一題|看成績/ }).click();
    }
    await expect(page.getByText(/答對 \d \/ 4 題/)).toBeVisible();

    await page.goto(forestUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/"));
    await page.getByRole("button", { name: new RegExp(`字母${run}`) }).click();
    await page.getByRole("button", { name: "大寫 A" }).click();
    await page.getByRole("button", { name: "小寫 a" }).click();
    await page.getByRole("button", { name: "大寫 B" }).click();
    await page.getByRole("button", { name: "小寫 b" }).click();
    await page.getByRole("button", { name: "看成績" }).click();
    await expect(page.getByText("答對 2 / 2 題")).toBeVisible();
  });

  test("使用中的圖片不能刪除", async ({ page }) => {
    await page.goto("/teacher/media");
    await page.getByRole("button", { name: `刪除 ${image}` }).click();
    await expect(alertOn(page)).toContainText("還有題目在使用");
  });
});
