import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const teacher = "00000000-0000-4000-8000-000000000001";
const studentA = "00000000-0000-4000-8000-00000000000a";
const studentB = "00000000-0000-4000-8000-00000000000b";
const inactive = "00000000-0000-4000-8000-00000000000c";
const classA = "10000000-0000-4000-8000-00000000000a";
const classB = "10000000-0000-4000-8000-00000000000b";
const archivedClass = "10000000-0000-4000-8000-00000000000c";

let db: PGlite;

/** 重現 Supabase 環境：角色、auth schema 與新資料表的預設授權。 */
const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function as<T>(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  run: () => Promise<T>,
): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false)`);
  await db.exec(`set role ${role}`);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}

const rows = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(bootstrap);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id) values ('${teacher}'), ('${studentA}'), ('${studentB}'), ('${inactive}');
    insert into public.profiles (id, role, display_name, username, is_active) values
      ('${teacher}', 'teacher', 'T', 'teacher', true),
      ('${studentA}', 'student', 'A', 'student-a', true),
      ('${studentB}', 'student', 'B', 'student-b', true),
      ('${inactive}', 'student', 'C', 'student-c', false);
    insert into public.classes (id, stage_id, name, created_by, is_archived)
      select v.id::uuid, s.id, v.name, '${teacher}', v.archived
      from public.learning_stages s,
      (values ('${classA}', 'A 班', false), ('${classB}', 'B 班', false), ('${archivedClass}', '封存班', true))
        as v(id, name, archived)
      where s.slug = 'kids';
    insert into public.student_classes (student_id, class_id) values
      ('${studentA}', '${classA}'), ('${studentB}', '${classB}'),
      ('${studentA}', '${archivedClass}'), ('${inactive}', '${classA}');
  `);
});

afterAll(() => db.close());

describe("所有資料表都受 RLS 保護", () => {
  it("public schema 沒有未啟用 RLS 的資料表", async () => {
    const unprotected = await rows(`
      select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    expect(unprotected).toEqual([]);
  });
});

describe("未登入者", () => {
  it.each(["profiles", "classes", "student_classes", "learning_stages"])(
    "讀不到 %s",
    async (table) => {
      await expect(as("anon", null, () => rows(`select * from public.${table}`))).rejects.toThrow(
        /permission denied/,
      );
    },
  );
});

describe("學生資料隔離", () => {
  it("學生 A 只讀得到自己的帳號", async () => {
    const result = await as("authenticated", studentA, () =>
      rows("select id from public.profiles"),
    );
    expect(result).toEqual([{ id: studentA }]);
  });

  it("學生 A 讀不到學生 B 的帳號", async () => {
    const result = await as("authenticated", studentA, () =>
      rows(`select id from public.profiles where id = '${studentB}'`),
    );
    expect(result).toEqual([]);
  });

  it("學生 A 只看得到自己所屬且未封存的班級", async () => {
    const result = await as("authenticated", studentA, () => rows("select id from public.classes"));
    expect(result).toEqual([{ id: classA }]);
  });

  it("學生 A 只看得到自己的成員紀錄，看不到同學", async () => {
    const result = await as("authenticated", studentA, () =>
      rows("select student_id from public.student_classes"),
    );
    expect(new Set(result.map((r) => r.student_id))).toEqual(new Set([studentA]));
  });

  it("離開班級後就看不到該班", async () => {
    await db.exec(`update public.student_classes set left_at = now()
      where student_id = '${studentB}' and class_id = '${classB}'`);
    const result = await as("authenticated", studentB, () => rows("select id from public.classes"));
    expect(result).toEqual([]);
    await db.exec(`update public.student_classes set left_at = null
      where student_id = '${studentB}' and class_id = '${classB}'`);
  });
});

describe("學生不能修改權限或資料", () => {
  it("學生不能把自己改成老師", async () => {
    await expect(
      as("authenticated", studentA, () =>
        rows(`update public.profiles set role = 'teacher' where id = '${studentA}'`),
      ),
    ).rejects.toThrow(/permission denied/);
    const [row] = await rows(`select role from public.profiles where id = '${studentA}'`);
    expect(row.role).toBe("student");
  });

  it("學生不能新增帳號", async () => {
    await expect(
      as("authenticated", studentA, () =>
        rows(`insert into public.profiles (id, role, display_name, username)
              values ('${studentB}', 'teacher', 'x', 'hacker')`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("學生不能建立班級", async () => {
    await expect(
      as("authenticated", studentA, () =>
        rows(`insert into public.classes (stage_id, name, created_by)
              select id, 'x', '${studentA}' from public.learning_stages limit 1`),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("學生不能修改班級", async () => {
    const result = await as("authenticated", studentA, async () => {
      await db.exec(`update public.classes set name = '被改了' where id = '${classA}'`);
      return true;
    });
    expect(result).toBe(true);
    const [row] = await rows(`select name from public.classes where id = '${classA}'`);
    expect(row.name).toBe("A 班");
  });

  it("學生不能把自己加入別的班級", async () => {
    await expect(
      as("authenticated", studentA, () =>
        rows(`insert into public.student_classes (student_id, class_id)
              values ('${studentA}', '${classB}')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("學生不能退出或刪除班級紀錄", async () => {
    await as("authenticated", studentA, () => db.exec("delete from public.student_classes"));
    const [row] = await rows(
      `select count(*)::int as n from public.student_classes where student_id = '${studentA}'`,
    );
    expect(row.n).toBe(2);
  });
});

describe("停用帳號", () => {
  it("即使登入憑證尚未過期，也讀不到任何資料", async () => {
    for (const table of ["profiles", "classes", "student_classes", "learning_stages"]) {
      const result = await as("authenticated", inactive, () =>
        rows(`select * from public.${table}`),
      );
      expect(result).toEqual([]);
    }
  });

  it("停用的老師失去管理權限", async () => {
    await db.exec(`update public.profiles set is_active = false where id = '${teacher}'`);
    const result = await as("authenticated", teacher, () => rows("select id from public.classes"));
    expect(result).toEqual([]);
    await db.exec(`update public.profiles set is_active = true where id = '${teacher}'`);
  });
});

describe("老師", () => {
  it("可讀取所有帳號與班級，含封存班級", async () => {
    const profiles = await as("authenticated", teacher, () => rows("select id from public.profiles"));
    const classes = await as("authenticated", teacher, () => rows("select id from public.classes"));
    expect(profiles).toHaveLength(4);
    expect(classes).toHaveLength(3);
  });

  it("可建立班級並加入學生", async () => {
    await as("authenticated", teacher, async () => {
      await db.exec(`
        insert into public.classes (id, stage_id, name)
          select '10000000-0000-4000-8000-00000000000d', id, '新班' from public.learning_stages where slug = 'junior';
        insert into public.student_classes (student_id, class_id)
          values ('${studentB}', '10000000-0000-4000-8000-00000000000d');
      `);
    });
    const [row] = await rows(
      `select created_by from public.classes where id = '10000000-0000-4000-8000-00000000000d'`,
    );
    expect(row.created_by).toBe(teacher);
  });

  it("不能直接修改帳號，必須走伺服器流程", async () => {
    await expect(
      as("authenticated", teacher, () =>
        rows(`update public.profiles set role = 'teacher' where id = '${studentA}'`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("老師帳號不能被加入班級", async () => {
    await expect(
      as("authenticated", teacher, () =>
        rows(`insert into public.student_classes (student_id, class_id)
              values ('${teacher}', '${classA}')`),
      ),
    ).rejects.toThrow(/only students/);
  });
});

describe("資料規則", () => {
  it("三個學習階段都已建立", async () => {
    const result = await rows("select slug from public.learning_stages order by order_index");
    expect(result.map((r) => r.slug)).toEqual(["kids", "junior", "senior"]);
  });

  it("帳號重複會被拒絕", async () => {
    await expect(
      rows(`insert into public.profiles (id, role, display_name, username)
            values ('${inactive}', 'student', 'x', 'student-a')`),
    ).rejects.toThrow(/duplicate key/);
  });
});
