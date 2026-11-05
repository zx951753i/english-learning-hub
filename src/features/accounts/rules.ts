import Papa from "papaparse";

/**
 * 學生沒有 email，Supabase Auth 需要 email 欄位，
 * 因此以帳號產生內部地址。.invalid 是保留網域，信件不可能寄出。
 */
export const AUTH_EMAIL_DOMAIN = "accounts.english-learning-hub.invalid";

export const MAX_IMPORT_ROWS = 200;
export const MIN_PASSWORD_LENGTH = 8;

export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export const isValidUsername = (username: string) => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username);

export const toAuthEmail = (username: string) => `${username}@${AUTH_EMAIL_DOMAIN}`;

export const USERNAME_HINT = "3–32 字，可用英文、數字、點、底線、連字號，開頭須為英文或數字";

export const isValidDisplayName = (name: string) => name.length >= 1 && name.length <= 50;

export function isValidPassword(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= 72;
}

const WORDS_A = [
  "Blue", "Brave", "Bright", "Calm", "Clever", "Cool", "Fast", "Gold",
  "Green", "Happy", "Kind", "Lucky", "Mint", "Neat", "Quick", "Red",
  "Shiny", "Smart", "Sunny", "Super", "Sweet", "Tall", "Warm", "Wise",
];
const WORDS_B = [
  "Bear", "Bird", "Cat", "Crab", "Deer", "Dog", "Dolphin", "Duck",
  "Eagle", "Fish", "Fox", "Frog", "Horse", "Koala", "Lion", "Monkey",
  "Otter", "Owl", "Panda", "Rabbit", "Seal", "Shark", "Tiger", "Whale",
];

/** 兩個單字加四位數，學生容易輸入，老師也容易口頭告知。 */
export function generatePassword() {
  const random = (limit: number) => crypto.getRandomValues(new Uint32Array(1))[0] % limit;
  const pick = (words: string[]) => words[random(words.length)];
  return `${pick(WORDS_A)}${pick(WORDS_B)}${1000 + random(9000)}`;
}

/** Excel 在繁體中文 Windows 另存 CSV 時預設為 Big5，這裡同時支援 UTF-8。 */
export function decodeCsv(bytes: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("big5").decode(bytes);
  }
}

export type StudentRow = { line: number; displayName: string; username: string; password: string };
export type RowError = { line: number; message: string };
export type ParsedRoster = { rows: StudentRow[]; errors: RowError[] };

const HEADER_ALIASES: Record<string, keyof Omit<StudentRow, "line">> = {
  姓名: "displayName",
  name: "displayName",
  帳號: "username",
  username: "username",
  密碼: "password",
  password: "password",
};

export function parseStudentCsv(text: string): ParsedRoster {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const [header, ...body] = parsed.data;
  if (!header) return { rows: [], errors: [{ line: 1, message: "檔案沒有內容。" }] };

  const columns = header.map((cell) => HEADER_ALIASES[cell.trim().toLowerCase()]);
  if (!columns.includes("displayName") || !columns.includes("username")) {
    return { rows: [], errors: [{ line: 1, message: "第一列必須包含「姓名」和「帳號」欄位。" }] };
  }
  if (body.length === 0) return { rows: [], errors: [{ line: 2, message: "檔案沒有學生資料。" }] };
  if (body.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, message: `一次最多匯入 ${MAX_IMPORT_ROWS} 位學生。` }],
    };
  }

  const rows: StudentRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();

  body.forEach((cells, index) => {
    const line = index + 2;
    const value = (key: keyof Omit<StudentRow, "line">) =>
      (cells[columns.indexOf(key)] ?? "").trim();
    const displayName = value("displayName");
    const username = normalizeUsername(value("username"));
    const password = value("password");

    if (!isValidDisplayName(displayName)) errors.push({ line, message: "姓名需為 1–50 字。" });
    if (!isValidUsername(username)) {
      errors.push({ line, message: `帳號「${username}」格式不正確。${USERNAME_HINT}。` });
    }
    if (password && !isValidPassword(password)) {
      errors.push({ line, message: `密碼需為 ${MIN_PASSWORD_LENGTH}–72 字；留空會自動產生。` });
    }
    const firstLine = seen.get(username);
    if (username && firstLine) {
      errors.push({ line, message: `帳號「${username}」與第 ${firstLine} 列重複。` });
    }
    if (username) seen.set(username, firstLine ?? line);
    rows.push({ line, displayName, username, password });
  });

  return { rows, errors };
}
