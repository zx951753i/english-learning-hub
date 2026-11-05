"use client";

import { Download } from "lucide-react";
import { useActionState } from "react";
import { CredentialList } from "@/components/credentials";
import { buttonClass } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { importStudents } from "@/features/accounts/actions";
import type { RowError } from "@/features/accounts/rules";

function ErrorList({ title, errors }: { title: string; errors: RowError[] }) {
  return (
    <div role="alert" className="rounded-control bg-danger-soft p-3 text-danger">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-inside list-disc text-sm">
        {errors.map((error, index) => (
          <li key={index}>
            {error.line > 0 ? `第 ${error.line} 列：` : ""}
            {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action] = useActionState(importStudents, {});

  return (
    <div className="space-y-5">
      {state.errors?.length ? (
        <ErrorList title="檔案有問題，沒有建立任何帳號：" errors={state.errors} />
      ) : null}
      {state.failed?.length ? (
        <ErrorList title="以下項目未完成：" errors={state.failed} />
      ) : null}
      {state.created?.length ? (
        <>
          <Notice tone="ok">已建立 {state.created.length} 位學生。</Notice>
          <CredentialList credentials={state.created} />
        </>
      ) : null}

      <a href="/templates/students-template.csv" download className={buttonClass("secondary")}>
        <Download size={18} aria-hidden />
        下載範本
      </a>
      <form action={action} className="space-y-4">
        <TextField
          label="CSV 檔案"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          hint="欄位：姓名、帳號、密碼。密碼可留空；一次最多 200 位。"
          className="w-full py-2"
        />
        <SelectField label="全部加入班級（選填）" name="classId" defaultValue="">
          <option value="">暫不加入</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>
        <SubmitButton pendingText="建立中，請勿關閉頁面…">開始建立</SubmitButton>
      </form>
    </div>
  );
}
