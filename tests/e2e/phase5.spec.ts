import { expect, test, type Page } from "@playwright/test";
import { addLevel, alertOn, loginTeacher, openTemplateZone, prepareContent, studentPage } from "./helpers";

const run = Date.now().toString(36);
const book = `任務教材${run}`;
const className = `任務班${run}`;
const amy = { name: `任務甲${run}`, username: `ta${run}`, password: "Playtest1234", join: true };
const ben = { name: `任務乙${run}`, username: `tb${run}`, password: "Playtest1234", join: true };
const outsider = { name: `任務外${run}`, username: `tc${run}`, password: "Playtest1234", join: false };
const words: Record<string, string> = { 貓: "cat", 狗: "dog", 帽子: "hat", 包包: "bag" };
let zoneUrl = "";
let studentZone = "";

/** 拼字遊戲：wrongFirst 為 true 時第一題故意答錯。 */
async function playSpelling(page: Page, wrongFirst: boolean) {
  await expect(page).toHaveURL(/play\/[0-9a-f-]{36}$/);
  const total = Number((await page.getByText(/^第 1 \/ \d+ 題$/).innerText()).match(/\/ (\d+)/)![1]);
  for (let i = 0; i < total; i += 1) {
    const prompt = await page.locator("p.text-2xl").innerText();
    await page.getByLabel(/拼出單字/).fill(wrongFirst && i === 0 ? "nope" : words[prompt]);
    await page.getByRole("button", { name: "送出答案" }).click();
    await page.getByRole("button", { name: /下一題|看成績/ }).click();
  }
  await expect(page).toHaveURL(/result$/);
}

test.describe.serial("Phase 5 任務、錯題本、學習紀錄", () => {
  test("老師：準備兩關，建立任務；不合理的對象會被拒絕", async ({ page }) => {
    await loginTeacher(page);
    await prepareContent(page, {
      book,
      className,
      students: [amy, ben, outsider],
      imports: [{ type: "單字", csv: "﻿單元,難度,英文單字,中文意思\r\nUnit 1,1,cat,貓\r\nUnit 1,1,dog,狗\r\nUnit 1,1,hat,帽子\r\nUnit 1,1,bag,包包\r\n" }],
    });
    await openTemplateZone(page, book, "Vocabulary Village");
    zoneUrl = page.url();
    studentZone = zoneUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/");
    await addLevel(page, zoneUrl, { type: "Word Spelling", title: `拼字一${run}` });
    await addLevel(page, zoneUrl, { type: "Word Spelling", title: `拼字二${run}` });

    await page.goto("/teacher/assignments/new");
    await page.getByLabel("關卡").selectOption({ label: `拼字二${run}` });
    await page.getByLabel("個別學生").check();
    await page.getByRole("checkbox", { name: new RegExp(outsider.name) }).check();
    await page.getByRole("button", { name: "建立任務" }).click();
    await expect(alertOn(page)).toContainText("沒有授權這本教材");

    await page.getByLabel("班級").check();
    await page.getByRole("checkbox", { name: className }).check();
    await page.getByLabel("期限（選填）").fill("2099-12-31");
    await page.getByLabel("給學生的話（選填）").fill("這週完成喔");
    await page.getByRole("button", { name: "建立任務" }).click();
    await expect(page).toHaveURL(/assignments\?created=1/);
    await expect(page.getByRole("link", { name: new RegExp(`拼字二${run}`) })).toContainText("完成 0 / 2");
  });

  test("學生：首頁看到任務；指派的第 2 關直接開放", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, amy);
    const tasks = page.getByRole("region", { name: "老師指派的任務" });
    await expect(tasks.getByText(`拼字二${run}`)).toBeVisible();
    await expect(tasks.getByText("這週完成喔")).toBeVisible();
    await expect(tasks.getByText(/期限 12\/31/)).toBeVisible();
    await expect(page.getByText("完成一個關卡")).toBeVisible();
    await expect(page.getByText("複習錯題本")).toHaveCount(0);

    await page.goto(studentZone);
    await expect(page.getByRole("button", { name: new RegExp(`第 2 關 拼字二${run}，開始`) })).toBeEnabled();
  });

  test("學生完成任務（2 顆星），答錯的題目進入錯題本", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, amy);
    await page.getByRole("button", { name: `開始任務：拼字二${run}` }).click();
    await playSpelling(page, true);
    await expect(page.getByRole("img", { name: "獲得 2 顆星，共 3 顆" })).toBeVisible();
    await expect(page.getByText("之後連續答對 2 次就會移出")).toBeVisible();

    await page.goto("/home");
    const tasks = page.getByRole("region", { name: "老師指派的任務" });
    await expect(tasks.getByText("已完成")).toBeVisible();
    await expect(page.getByText("完成一個關卡，已完成")).toBeAttached();
    await expect(page.getByText("複習錯題本，未完成")).toBeAttached();
    await expect(page.getByText("錯題本還有 1 題")).toBeVisible();
    await expect(page.getByText("今天的任務完成了！")).toHaveCount(0);
  });

  test("錯題複習：全對得到 Review Master，完成今日任務得到 Daily Explorer", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, amy);
    await page.getByRole("link", { name: "錯題本" }).click();
    await expect(page.getByRole("heading", { name: "共 1 題要複習" })).toBeVisible();
    await page.getByRole("button", { name: "開始複習：Word Spelling" }).click();
    await playSpelling(page, false);
    await expect(page.getByRole("heading", { name: "複習完成！" })).toBeVisible();
    await expect(page.getByText("Review Master")).toBeVisible();
    await expect(page.getByText("Daily Explorer")).toBeVisible();
    await expect(page.getByText("繼續加油，再答對一次就能移出錯題本。")).toBeVisible();

    await page.getByRole("link", { name: "回到錯題本" }).click();
    await page.getByRole("button", { name: "開始複習：Word Spelling" }).click();
    await playSpelling(page, false);
    await expect(page.getByText("1 題已經學會，移出錯題本了！")).toBeVisible();
    await expect(page.getByText("Review Master")).toHaveCount(0);

    await page.getByRole("link", { name: "回到錯題本" }).click();
    await expect(page.getByText("錯題本是空的，太棒了！")).toBeVisible();

    await page.goto("/home");
    await expect(page.getByText("今天的任務完成了！")).toBeVisible();
    await expect(page.getByText("錯題本清空了")).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的徽章（3 / 5）" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("老師：任務完成情況、學生學習紀錄與作答明細", async ({ page }) => {
    await loginTeacher(page);
    await page.goto("/teacher/assignments");
    await page.getByRole("link", { name: new RegExp(`拼字二${run}`) }).click();
    await expect(page.getByRole("heading", { name: "完成情況（1 / 2）" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: amy.name })).toContainText("已完成");
    await expect(page.getByRole("listitem").filter({ hasText: ben.name })).toContainText("尚未作答");

    await page.getByRole("link", { name: amy.name }).click();
    await expect(page.getByRole("heading", { name: "學習紀錄" })).toBeVisible();
    await expect(page.getByText("共 3 局")).toBeVisible();
    await expect(page.getByRole("heading", { name: "錯題本（0）" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "指派的任務" })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(`拼字二${run}`) }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: `拼字二${run}` })).toBeVisible();
    await expect(page.getByRole("cell", { name: "nope" })).toBeVisible();
    await expect(page.locator('[aria-label="答錯"]')).toHaveCount(1);
    await expect(page.locator('[aria-label="答對"]')).toHaveCount(3);

    await page.goto("/teacher");
    await expect(page.getByRole("heading", { name: "最近的練習" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(amy.name) }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`${ben.name}.*7 天沒有練習`) })).toBeVisible();
  });

  test("老師修改期限、停用任務後學生看不到；刪除任務不影響紀錄", async ({ page, browser, baseURL }) => {
    await loginTeacher(page);
    await page.goto("/teacher/assignments");
    await page.getByRole("link", { name: new RegExp(`拼字二${run}`) }).click();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("期限（選填）").fill("2099-01-15");
    await page.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(page.getByText("已儲存。")).toBeVisible();

    await page.getByRole("button", { name: "停用任務" }).click();
    await expect(page.getByRole("button", { name: "重新啟用" })).toBeVisible();
    const kid = await studentPage(browser, baseURL, ben);
    await expect(kid.getByRole("region", { name: "老師指派的任務" })).toHaveCount(0);

    await page.getByRole("button", { name: "刪除任務" }).click();
    await page.getByRole("button", { name: "確定刪除" }).click();
    await expect(page).toHaveURL(/\/teacher\/assignments$/);
    await expect(page.getByRole("link", { name: new RegExp(`拼字二${run}`) })).toHaveCount(0);

    const amyPage = await studentPage(browser, baseURL, amy);
    await amyPage.goto(studentZone);
    await expect(amyPage.getByRole("button", { name: new RegExp(`第 2 關 拼字二${run}，已完成 2 顆星`) })).toBeVisible();
  });

  test("學生進不了老師的任務頁；沒有錯題時錯題本是空的", async ({ browser, baseURL }) => {
    const other = await studentPage(browser, baseURL, outsider);
    await other.goto("/teacher/assignments");
    await expect(other).toHaveURL(/\/home$/);
    await other.goto("/mistakes");
    await expect(other.getByText("錯題本是空的，太棒了！")).toBeVisible();
  });
});
