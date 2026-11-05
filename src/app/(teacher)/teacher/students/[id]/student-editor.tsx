"use client";

import { useActionState } from "react";
import { CredentialList } from "@/components/credentials";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  resetStudentPassword,
  updateStudent,
  type ResetPasswordState,
} from "@/features/accounts/actions";
import { USERNAME_HINT } from "@/features/accounts/rules";

type Student = { id: string; display_name: string; username: string };

export function StudentEditor({ student }: { student: Student }) {
  const [state, action] = useActionState(updateStudent.bind(null, student.id), {});
  return (
    <form action={action} className="space-y-4">
      <TextField label="姓名或暱稱" name="displayName" defaultValue={student.display_name} required maxLength={50} />
      <TextField
        label="帳號"
        name="username"
        defaultValue={student.username}
        required
        hint={USERNAME_HINT}
        autoCapitalize="none"
        spellCheck={false}
      />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…">儲存</SubmitButton>
    </form>
  );
}

export function ResetPassword({ student }: { student: Student }) {
  const [state, action] = useActionState<ResetPasswordState>(() => resetStudentPassword(student.id), {});
  return (
    <div className="space-y-3">
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.password ? (
        <CredentialList
          credentials={[
            { displayName: student.display_name, username: student.username, password: state.password },
          ]}
        />
      ) : null}
      <form action={action}>
        <SubmitButton variant="secondary" pendingText="重設中…">
          產生新密碼
        </SubmitButton>
      </form>
    </div>
  );
}
