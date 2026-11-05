import { describe, expect, it, vi } from "vitest";
import {
  decodeCsv,
  generatePassword,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  parseStudentCsv,
  toAuthEmail,
} from "@/features/accounts/rules";
import { createStudentAccount, setStudentActive } from "@/features/accounts/service";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("帳號規則", () => {
  it("帳號統一轉小寫並去除空白", () => {
    expect(normalizeUsername("  Amy.Lin ")).toBe("amy.lin");
  });

  it.each(["amy", "amy.lin", "s1001", "a_b-c"])("接受 %s", (name) => {
    expect(isValidUsername(name)).toBe(true);
  });

  it.each(["ab", "-amy", "王小明", "amy lin", "a@b.c"])("拒絕 %s", (name) => {
    expect(isValidUsername(name)).toBe(false);
  });

  it("內部 email 使用不可投遞的保留網域", () => {
    expect(toAuthEmail("amy")).toMatch(/^amy@.+\.invalid$/);
  });

  it("自動密碼符合長度規則且不重複", () => {
    const passwords = new Set(Array.from({ length: 50 }, generatePassword));
    expect(passwords.size).toBeGreaterThan(45);
    passwords.forEach((password) => expect(isValidPassword(password)).toBe(true));
  });
});

describe("CSV 匯入", () => {
  it("讀取含 BOM 的中文表頭，密碼可留空", () => {
    const { rows, errors } = parseStudentCsv("﻿姓名,帳號,密碼\r\n王小明,Amy01,\r\n");
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ line: 2, displayName: "王小明", username: "amy01", password: "" }]);
  });

  it("可讀取 Excel 另存的 Big5 檔案", () => {
    const big5 = new Uint8Array([0xa9, 0x6d, 0xa6, 0x57, 0x2c, 0xb1, 0x62, 0xb8, 0xb9]);
    expect(decodeCsv(big5.buffer)).toBe("姓名,帳號");
  });

  it("欄位順序不同也能讀取", () => {
    const { rows } = parseStudentCsv("帳號,姓名\namy01,王小明\n");
    expect(rows[0]).toMatchObject({ displayName: "王小明", username: "amy01" });
  });

  it("缺少必要欄位時整份拒絕", () => {
    expect(parseStudentCsv("姓名,電話\n王小明,0912\n").errors[0].message).toContain("帳號");
  });

  it("指出重複帳號與錯誤所在列", () => {
    const { errors } = parseStudentCsv("姓名,帳號\nA,amy01\nB,AMY01\nC,!!\n");
    expect(errors.map((error) => error.line)).toEqual([3, 4]);
  });

  it("限制單次匯入數量", () => {
    const body = Array.from({ length: 201 }, (_, i) => `A,user${i}`).join("\n");
    expect(parseStudentCsv(`姓名,帳號\n${body}`).errors[0].message).toContain("200");
  });
});

function fakeAdmin(options: { createError?: object; insertError?: object; updateError?: object }) {
  const deleteUser = vi.fn().mockResolvedValue({});
  const updateUserById = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  const insert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });
  const update = vi.fn(() => ({
    eq: () => {
      const result = Promise.resolve({ error: null });
      return Object.assign(result, { eq: () => Promise.resolve({ error: null }) });
    },
  }));
  const admin = {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: options.createError ? { user: null } : { user: { id: "u1" } },
          error: options.createError ?? null,
        }),
        deleteUser,
        updateUserById,
      },
    },
    from: () => ({ insert, update }),
  } as unknown as SupabaseClient;
  return { admin, deleteUser, updateUserById, insert, update };
}

describe("建立學生帳號", () => {
  it("成功時回傳自動產生的密碼", async () => {
    const { admin, insert } = fakeAdmin({});
    const result = await createStudentAccount(admin, { displayName: "A", username: "amy01" });
    expect(result).toMatchObject({ ok: true, id: "u1" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ role: "student" }));
  });

  it("帳號重複時回報 duplicate", async () => {
    const { admin } = fakeAdmin({ createError: { code: "email_exists", status: 422 } });
    const result = await createStudentAccount(admin, { displayName: "A", username: "amy01" });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("profile 建立失敗時移除登入帳號，不留半套資料", async () => {
    const { admin, deleteUser } = fakeAdmin({ insertError: { code: "500" } });
    const result = await createStudentAccount(admin, { displayName: "A", username: "amy01" });
    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });
});

describe("停用學生", () => {
  it("停用時同時封鎖登入", async () => {
    const { admin, updateUserById } = fakeAdmin({});
    await expect(setStudentActive(admin, "u1", false)).resolves.toBe(true);
    expect(updateUserById).toHaveBeenCalledWith("u1", { ban_duration: "876000h" });
  });

  it("封鎖失敗時還原資料狀態", async () => {
    const { admin, update } = fakeAdmin({ updateError: { message: "x" } });
    await expect(setStudentActive(admin, "u1", false)).resolves.toBe(false);
    expect(update).toHaveBeenLastCalledWith({ is_active: true });
  });
});
