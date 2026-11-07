import { expect, type Browser, type Page } from "@playwright/test";

export const teacher = {
  username: process.env.E2E_TEACHER_USERNAME!,
  password: process.env.E2E_TEACHER_PASSWORD!,
};

export async function login(page: Page, username: string, password: string, url: RegExp) {
  await page.goto("/login");
  await page.getByLabel("帳號").fill(username);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(url);
}

export const loginTeacher = (page: Page) => login(page, teacher.username, teacher.password, /\/teacher$/);

export async function studentPage(browser: Browser, baseURL: string | undefined, who: { username: string; password: string }) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await login(page, who.username, who.password, /\/home$/);
  return page;
}

export const alertOn = (page: Page) => page.locator('main [role="alert"]');

/** 建立 Kids 教材、匯入確認過的題目、建立學生與班級並授權。 */
export async function prepareContent(
  page: Page,
  options: {
    book: string;
    className: string;
    students: { name: string; username: string; password: string; join: boolean }[];
    imports: { type: string; csv: string }[];
  },
) {
  await page.goto("/teacher/textbooks/new");
  await page.getByLabel("學習階段").selectOption({ label: "English Kids" });
  await page.getByLabel("教材名稱").fill(options.book);
  await page.getByLabel("先建立幾個單元").fill("1");
  await page.getByRole("button", { name: "建立教材" }).click();
  await expect(page.getByRole("heading", { name: "單元（1）" })).toBeVisible();

  for (const item of options.imports) {
    await page.goto("/teacher/questions/import");
    await page.getByRole("combobox", { name: /^教材/ }).selectOption({ label: options.book });
    await page.getByLabel("題目類型").selectOption({ label: item.type });
    await page.getByLabel("Excel 或 CSV 檔案").setInputFiles({ name: "q.csv", mimeType: "text/csv", buffer: Buffer.from(item.csv) });
    await page.getByRole("button", { name: "上傳並預覽" }).click();
    await expect(page.getByText(/有問題 0 列/)).toBeVisible();
    await page.getByLabel("題目來源").selectOption({ label: "Teacher Original：老師確認的原創題目" });
    await page.getByLabel("我已確認這批題目與答案，匯入後直接開放使用").check();
    await page.getByRole("button", { name: /確認匯入/ }).click();
    await expect(page.getByText(/已匯入 \d+ 題/)).toBeVisible();
  }

  for (const who of options.students) {
    await page.goto("/teacher/students/new");
    await page.getByLabel("姓名或暱稱").fill(who.name);
    await page.getByLabel("帳號").fill(who.username);
    await page.getByLabel("密碼（選填）").fill(who.password);
    await page.getByRole("button", { name: "建立學生" }).click();
    await expect(page.getByRole("row", { name: new RegExp(who.username) })).toBeVisible();
  }

  await page.goto("/teacher/classes/new");
  await page.getByLabel("班級名稱").fill(options.className);
  await page.getByLabel("學習階段").selectOption({ label: "English Kids" });
  await page.getByRole("button", { name: "建立班級" }).click();
  await expect(page).toHaveURL(/classes\/[0-9a-f-]{36}$/);
  for (const who of options.students.filter((item) => item.join)) {
    await page.getByRole("checkbox", { name: new RegExp(who.name) }).check();
  }
  await page.getByRole("button", { name: "加入所選學生" }).click();
  await page.getByLabel("選擇教材").selectOption({ label: options.book });
  await page.getByRole("button", { name: "授權", exact: true }).click();
  await expect(page.getByRole("heading", { name: "授權教材（1）" })).toBeVisible();
}

export async function openBook(page: Page, book: string) {
  await page.goto("/teacher/islands?stage=kids");
  const tab = page.getByRole("link", { name: book, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-current", "page");
}

/** 用範本建立區域，回到指定區域頁面。 */
export async function openTemplateZone(page: Page, book: string, zone: string) {
  await openBook(page, book);
  await page.getByRole("button", { name: "用範本建立區域" }).click();
  await expect(page.getByRole("heading", { name: "學習區域（7）" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(zone) }).click();
  await expect(page.getByRole("heading", { level: 1, name: zone })).toBeVisible();
}

export async function addLevel(
  page: Page,
  zoneUrl: string,
  options: { type: string; title: string; unlock?: string; boss?: boolean; publish?: boolean },
) {
  await page.goto(zoneUrl);
  await page.getByLabel("遊戲類型").selectOption({ label: options.type });
  await page.getByRole("combobox", { name: /^單元/ }).selectOption({ label: "Unit 1" });
  await page.getByLabel("關卡名稱").fill(options.title);
  if (options.unlock) await page.getByLabel("解鎖條件").selectOption({ label: options.unlock });
  if (options.boss) await page.getByLabel("這是終極挑戰關（地圖上顯示皇冠）").check();
  await page.getByRole("button", { name: "新增關卡" }).click();
  await expect(page).toHaveURL(/islands\/levels\/[0-9a-f-]{36}/);
  if (options.publish !== false) {
    await page.getByRole("button", { name: "發布到地圖" }).click();
    await expect(page.getByRole("button", { name: "取消發布" })).toBeVisible();
  }
  return page.url();
}
