import { expect, test, type Page } from "@playwright/test";
import { addLevel, openBook, alertOn, loginTeacher, openTemplateZone, prepareContent, studentPage } from "./helpers";

const run = Date.now().toString(36);
const book = `冒險教材${run}`;
const student = { name: `冒險學生${run}`, username: `adv${run}`, password: "Playtest1234", join: true };
const answers: Record<string, string> = { 貓: "cat", 狗: "dog", 帽子: "hat", 包包: "bag" };
let zoneUrl = "";
let studentZone = "";

async function playSpelling(page: Page, correct: boolean) {
  for (let i = 0; i < 4; i += 1) {
    const prompt = await page.locator("p.text-2xl").innerText();
    await page.getByLabel(/拼出單字/).fill(correct ? answers[prompt] : "nope");
    await page.getByRole("button", { name: "送出答案" }).click();
    await page.getByRole("button", { name: /下一題|看成績/ }).click();
  }
  await expect(page).toHaveURL(/result$/);
}

test.describe.serial("Phase 4 冒險世界", () => {
  test("老師：範本區域、建立 3 關、排序與發布", async ({ page }) => {
    await loginTeacher(page);
    await prepareContent(page, {
      book,
      className: `冒險班${run}`,
      students: [student],
      imports: [{ type: "單字", csv: "﻿單元,難度,英文單字,中文意思\r\nUnit 1,1,cat,貓\r\nUnit 1,1,dog,狗\r\nUnit 1,1,hat,帽子\r\nUnit 1,1,bag,包包\r\n" }],
    });
    await openTemplateZone(page, book, "Vocabulary Village");
    zoneUrl = page.url();
    studentZone = zoneUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/");

    await addLevel(page, zoneUrl, { type: "Word Spelling", title: "第一關" });
    await addLevel(page, zoneUrl, { type: "Word Spelling", title: "第二關", unlock: "上一關拿到 2 顆星" });
    await addLevel(page, zoneUrl, { type: "Word Spelling", title: "終極關", boss: true });

    await page.goto(zoneUrl);
    await expect(page.getByRole("heading", { name: "關卡路線（3）" })).toBeVisible();
    await page.getByRole("button", { name: "將 第二關 下移" }).click();
    await expect(page.locator("ol > li").nth(1)).toContainText("終極關");
    await page.getByRole("button", { name: "將 第二關 上移" }).click();
    await expect(page.locator("ol > li").nth(1)).toContainText("第二關");

    await openBook(page, book);
    await page.getByRole("button", { name: "用範本建立區域" }).click();
    await expect(page.getByRole("heading", { name: "學習區域（7）" })).toBeVisible();
  });

  test("星星門檻不合理時拒絕，內容保留", async ({ page }) => {
    await loginTeacher(page);
    await page.goto(zoneUrl);
    await page.getByRole("link", { name: /第一關/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "第一關" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("2 星門檻（正確率 %）").fill("95");
    await page.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(alertOn(page)).toContainText("2 星門檻要低於 3 星");
    await expect(page.getByLabel("2 星門檻（正確率 %）")).toHaveValue("95");
  });

  test("學生：世界地圖、島嶼、關卡路線與鎖定狀態", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, student);
    await expect(page.getByText("Lv.1 小小探險家")).toBeVisible();
    await expect(page.getByText("0 顆星", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "出發：第一關" })).toBeVisible();
    await page.getByRole("link", { name: /English Kids Island/ }).click();
    await expect(page).toHaveURL(/island\/kids/);
    await expect(page.getByText(book, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Vocabulary Village/ })).toContainText("下一關在這裡");
    await page.getByRole("link", { name: /Vocabulary Village/ }).click();
    await expect(page.getByRole("button", { name: /第 1 關 第一關，開始/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /第 2 關 第二關，尚未解鎖：先在上一關拿到 2 顆星/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /第 3 關 終極關，尚未解鎖：先完成上一關/ })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("1 顆星：First Mission 徽章；下一關需要 2 顆星所以仍鎖定", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, student);
    await page.goto(studentZone);
    await page.getByRole("button", { name: /第 1 關 第一關，開始/ }).click();
    await playSpelling(page, false);
    await expect(page.getByRole("img", { name: "獲得 1 顆星，共 3 顆" })).toBeVisible();
    await expect(page.getByText("First Mission")).toBeVisible();
    await expect(page.getByText("下一關「第二關」：先在上一關拿到 2 顆星")).toBeVisible();
    await page.reload();
    await expect(page.getByText("First Mission")).toBeVisible();

    await page.goto(studentZone);
    await expect(page.getByRole("button", { name: /第 2 關 第二關，尚未解鎖：先在上一關拿到 2 顆星/ })).toBeDisabled();
  });

  test("3 顆星：Perfect Score；下一關解鎖；重玩較低分星數不降", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, student);
    await page.goto(studentZone);
    await page.getByRole("button", { name: /第 1 關 第一關，已完成 1 顆星/ }).click();
    await playSpelling(page, true);
    await expect(page.getByRole("img", { name: "獲得 3 顆星，共 3 顆" })).toBeVisible();
    await expect(page.getByText("Perfect Score")).toBeVisible();
    await expect(page.getByText("下一關已開放")).toBeVisible();

    await page.getByRole("button", { name: "再挑戰一次" }).click();
    await playSpelling(page, false);
    await expect(page.getByRole("img", { name: "獲得 1 顆星，共 3 顆" })).toBeVisible();
    await expect(page.getByText("Perfect Score")).toHaveCount(0);

    await page.goto(studentZone);
    await expect(page.getByRole("button", { name: /第 1 關 第一關，已完成 3 顆星/ })).toBeVisible();
    await page.getByRole("button", { name: /第 2 關 第二關，開始/ }).click();
    await playSpelling(page, true);
    await expect(page.getByRole("button", { name: "前往下一關" })).toBeVisible();
    await page.getByRole("button", { name: "前往下一關" }).click();
    await expect(page).toHaveURL(/play\/[0-9a-f-]{36}$/);
  });

  test("首頁：星星、等級、最近關卡、徽章與換頭像", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, student);
    await expect(page.getByText("6 顆星", { exact: true })).toBeVisible();
    await expect(page.getByText("再拿 4 顆星，就能升到 Lv.2")).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的徽章（2 / 5）" })).toBeVisible();
    await expect(page.getByRole("region", { name: "最近完成的關卡" }).getByText("第二關")).toBeVisible();
    await page.getByText("換頭像").click();
    await page.getByRole("button", { name: "選擇魔法師" }).click();
    await expect(page.getByRole("button", { name: "選擇魔法師" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await page.getByText("換頭像").click();
    await expect(page.getByRole("button", { name: "選擇魔法師" })).toHaveAttribute("aria-pressed", "true");
  });

  test("老師關閉區域後，學生看不到", async ({ page, browser, baseURL }) => {
    await loginTeacher(page);
    await page.goto(zoneUrl);
    await page.getByRole("button", { name: "關閉區域" }).click();
    await expect(page.getByRole("button", { name: "開放區域" })).toBeVisible();
    const kid = await studentPage(browser, baseURL, student);
    await kid.goto(studentZone);
    await expect(kid.getByText("找不到這個頁面")).toBeVisible();
    await page.getByRole("button", { name: "開放區域" }).click();
    await expect(page.getByRole("button", { name: "關閉區域" })).toBeVisible();
  });
});
