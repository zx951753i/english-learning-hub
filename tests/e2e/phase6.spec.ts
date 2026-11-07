import { expect, test, type Page } from "@playwright/test";
import { addLevel, alertOn, loginTeacher, openTemplateZone, prepareContent, studentPage } from "./helpers";

const run = Date.now().toString(36);
const book = `新遊戲教材${run}`;
const kid = { name: `新遊戲學生${run}`, username: `ng${run}`, password: "Playtest1234", join: true };
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const mp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(200)]);
const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(40)]);
const cat = `cat${run}.png`;
const dog = `dog${run}.png`;
const sound = `cat${run}.mp3`;
const sentences: Record<string, string[]> = {
  我喜歡貓: ["I", "like", "cats."],
  牠是一隻狗: ["It", "is", "a dog."],
};
let zoneUrl = "";
let studentZone = "";

/** 依目前畫面的題型作答：選擇題選第一個、拼字隨便填、詞塊依目前順序。 */
async function answerAny(page: Page) {
  const board = page.getByLabel("詞塊");
  if (await board.count()) {
    const tiles = await board.getByRole("button").count();
    for (let i = 0; i < tiles; i += 1) await board.getByRole("button").first().click();
    await page.getByRole("button", { name: "送出答案" }).click();
    return "order_chunks";
  }
  const spelling = page.getByLabel(/拼出單字/);
  if (await spelling.count()) {
    await spelling.fill("zzz");
    await page.getByRole("button", { name: "送出答案" }).click();
    return "text_input";
  }
  await page.locator("button[aria-pressed]").first().click();
  return "single_choice";
}

async function playAll(page: Page) {
  await expect(page).toHaveURL(/play\/[0-9a-f-]{36}$/);
  const seen = new Set<string>();
  const total = Number((await page.getByText(/^第 1 \/ \d+ 題$/).innerText()).match(/\/ (\d+)/)![1]);
  for (let i = 0; i < total; i += 1) {
    await expect(page.getByText(`第 ${i + 1} / ${total} 題`)).toBeVisible();
    seen.add(await answerAny(page));
    await page.getByRole("button", { name: /下一題|看成績/ }).click();
  }
  await expect(page).toHaveURL(/result$/);
  return seen;
}

test.describe.serial("Phase 6 新遊戲、Final Boss、音檔", () => {
  test("媒體庫：上傳圖片與音檔，音檔可播放；拒絕 HEIC 照片", async ({ page }) => {
    await loginTeacher(page);
    await page.goto("/teacher/media");
    const input = page.getByLabel("選擇圖片或音檔（可多選）");
    await input.setInputFiles([
      { name: cat, mimeType: "image/png", buffer: png },
      { name: dog, mimeType: "image/png", buffer: png },
      { name: sound, mimeType: "audio/mpeg", buffer: mp3 },
    ]);
    await expect(page.getByText("已上傳 3 個檔案")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(`播放 ${sound}`)).toBeAttached();
    await input.setInputFiles({ name: "photo.heic", mimeType: "image/heic", buffer: heic });
    await expect(alertOn(page)).toContainText("不是支援的圖片或音檔");
  });

  test("準備題目：單字（圖片、音檔）、自然發音、句子；找不到音檔時匯入被擋下", async ({ page }) => {
    await loginTeacher(page);
    await prepareContent(page, {
      book,
      className: `新遊戲班${run}`,
      students: [kid],
      imports: [
        {
          type: "單字",
          csv: `﻿單元,難度,英文單字,中文意思,圖片,音檔\r\nUnit 1,1,cat,貓,${cat},${sound}\r\nUnit 1,1,dog,狗,${dog},\r\nUnit 1,1,hat,帽子,,\r\nUnit 1,1,bag,包包,,\r\n`,
        },
        { type: "自然發音", csv: "﻿單元,難度,字母或字母組合,發音,例字\r\nUnit 1,1,a,/æ/,cat\r\nUnit 1,1,b,/b/,bag\r\nUnit 1,1,sh,/ʃ/,ship\r\nUnit 1,1,m,/m/,map\r\n" },
        {
          type: "句子",
          csv: "﻿單元,難度,英文句子,中文翻譯,重組切分\r\nUnit 1,1,I like cats.,我喜歡貓,I / like / cats.\r\nUnit 1,1,It is a dog.,牠是一隻狗,It / is / a dog.\r\n",
        },
      ],
    });

    await page.goto("/teacher/questions/import");
    await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: book });
    await page.getByLabel("題目類型").selectOption({ label: "單字" });
    await page.getByLabel("Excel 或 CSV 檔案").setInputFiles({
      name: "q.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("﻿單元,難度,英文單字,中文意思,音檔\r\nUnit 1,1,pen,筆,missing.mp3\r\n"),
    });
    await page.getByRole("button", { name: "上傳並預覽" }).click();
    await expect(page.getByText("媒體庫找不到音檔「missing.mp3」")).toBeVisible();
  });

  test("老師建立四種新關卡；Final Boss 自動成為終極關", async ({ page }) => {
    await loginTeacher(page);
    await openTemplateZone(page, book, "Vocabulary Village");
    zoneUrl = page.url();
    studentZone = zoneUrl.replace(/.*\/teacher\/islands\/zones\//, "/zone/");
    await addLevel(page, zoneUrl, { type: "Picture Vocabulary", title: `看圖${run}`, unlock: "一律開放" });
    await expect(page.getByText("可用題目 2 題")).toBeVisible();
    await addLevel(page, zoneUrl, { type: "Phonics Sound Match", title: `發音${run}`, unlock: "一律開放" });
    await addLevel(page, zoneUrl, { type: "Sentence Builder", title: `句子${run}`, unlock: "一律開放" });
    await addLevel(page, zoneUrl, { type: "Final Boss Challenge", title: `魔王${run}`, unlock: "一律開放" });
    await expect(page.getByText("可用題目 10 題")).toBeVisible();
    await page.goto(zoneUrl);
    await expect(page.locator("ol > li").nth(3).getByLabel("終極挑戰")).toBeVisible();
  });

  test("Picture Vocabulary：顯示題目圖片，選項是英文單字", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, kid);
    await page.goto(studentZone);
    await page.getByRole("button", { name: new RegExp(`看圖${run}`) }).click();
    await expect(page.getByText("看圖片，選出正確的單字")).toBeVisible();
    await expect(page.getByRole("img", { name: "題目圖片" })).toBeVisible();
    await expect(page.locator("button[aria-pressed]", { hasText: /^(cat|dog|hat|bag)$/ })).toHaveCount(4);
    await playAll(page);
    await expect(page.getByText(/答對 \d \/ 2 題/)).toBeVisible();
  });

  test("Phonics Sound Match：聽例字，選字母（大字選項）", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, kid);
    await page.goto(studentZone);
    await page.getByRole("button", { name: new RegExp(`發音${run}`) }).click();
    await expect(page.getByText("聽聽看，這個字有哪一個發音？")).toBeVisible();
    await expect(page.getByRole("button", { name: "聽發音" })).toBeVisible();
    await expect(page.locator("button[aria-pressed].text-4xl").first()).toBeVisible();
    await playAll(page);
    await expect(page.getByText(/答對 \d \/ 4 題/)).toBeVisible();
  });

  test("Sentence Builder：排對答對，排錯答錯，可以移除詞塊重排", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, kid);
    await page.goto(studentZone);
    await page.getByRole("button", { name: new RegExp(`句子${run}`) }).click();
    for (let i = 0; i < 2; i += 1) {
      const prompt = await page.locator("p.text-2xl").innerText();
      const correct = sentences[prompt];
      const board = page.getByLabel("詞塊");
      if (i === 0) {
        await board.getByRole("button", { name: correct[0], exact: true }).click();
        await page.getByRole("button", { name: `移除 ${correct[0]}` }).click();
        for (const chunk of correct) await board.getByRole("button", { name: chunk, exact: true }).click();
        await expect(page.getByLabel("我排的句子")).toContainText(correct.join(""));
        await page.getByRole("button", { name: "送出答案" }).click();
        await expect(page.getByText("答對了！")).toBeVisible();
      } else {
        for (const chunk of [...correct].reverse()) await board.getByRole("button", { name: chunk, exact: true }).click();
        await page.getByRole("button", { name: "送出答案" }).click();
        await expect(page.getByText("再接再厲")).toBeVisible();
        await expect(page.getByText(`正確答案：${correct.join(" ")}`)).toBeVisible();
      }
      await page.getByRole("button", { name: /下一題|看成績/ }).click();
    }
    await expect(page.getByText("答對 1 / 2 題")).toBeVisible();
  });

  test("Final Boss Challenge：一局混合多種玩法", async ({ browser, baseURL }) => {
    const page = await studentPage(browser, baseURL, kid);
    await page.goto(studentZone);
    await page.getByRole("button", { name: new RegExp(`魔王${run}`) }).click();
    const seen = await playAll(page);
    expect(seen.size).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(/答對 \d+ \/ \d+ 題/)).toBeVisible();
  });

  test("有上傳音檔的單字，按「聽發音」播放老師的音檔", async ({ page, browser, baseURL }) => {
    await loginTeacher(page);
    const level = await addLevel(page, zoneUrl, { type: "Word Spelling", title: `音檔${run}`, unlock: "一律開放" });
    expect(level).toBeTruthy();
    const kidPage = await studentPage(browser, baseURL, kid);
    await kidPage.goto(studentZone);
    await kidPage.getByRole("button", { name: new RegExp(`音檔${run}`) }).click();
    for (let i = 0; i < 4; i += 1) {
      const prompt = await kidPage.locator("p.text-2xl").innerText();
      if (prompt === "貓") {
        const request = kidPage.waitForRequest((req) => req.url().includes("/storage/v1/") && req.url().includes("token"));
        await kidPage.getByRole("button", { name: "聽發音" }).click();
        await request;
        return;
      }
      await kidPage.getByLabel(/拼出單字/).fill("x");
      await kidPage.getByRole("button", { name: "送出答案" }).click();
      await kidPage.getByRole("button", { name: /下一題|看成績/ }).click();
    }
    throw new Error("沒有出現「貓」這一題");
  });
});
