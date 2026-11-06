"use client";

import { ActionForm } from "@/components/ui/action-form";
import Link from "next/link";
import { useActionState, useRef, useEffect } from "react";
import { CredentialList } from "@/components/credentials";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createStudent } from "@/features/accounts/actions";
import { USERNAME_HINT } from "@/features/accounts/rules";

export function StudentForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createStudent, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.credential && !state.error) form.current?.reset();
  }, [state]);

  return (
    <div className="space-y-5">
      {state.credential ? (
        <>
          <Notice tone="ok">已建立 {state.credential.displayName} 的帳號。</Notice>
          <CredentialList credentials={[state.credential]} />
        </>
      ) : null}
      <ActionForm ref={form} action={action} className="space-y-4">
        <TextField label="姓名或暱稱" name="displayName" required maxLength={50} autoComplete="off" />
        <TextField
          label="帳號"
          name="username"
          required
          hint={USERNAME_HINT}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <TextField
          label="密碼（選填）"
          name="password"
          hint="留空會自動產生好記的密碼，例如兩個英文單字加四位數字"
          autoComplete="new-password"
        />
        <SelectField label="加入班級（選填）" name="classId" defaultValue="">
          <option value="">暫不加入</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>
        {state.error ? <Notice>{state.error}</Notice> : null}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="建立中…">建立學生</SubmitButton>
          <Link href="/teacher/students" className="text-navy underline underline-offset-4">
            回到學生列表
          </Link>
        </div>
      </ActionForm>
    </div>
  );
}
