"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { login } from "@/features/auth/actions";

export function LoginForm() {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4">
      <TextField
        label="帳號"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <TextField label="密碼" name="password" type="password" autoComplete="current-password" required />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <SubmitButton pendingText="登入中…" className="w-full">
        登入
      </SubmitButton>
    </form>
  );
}
