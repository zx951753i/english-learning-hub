"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateAssignment } from "@/features/assignments/actions";

export function AssignmentEditor({ id, dueOn, note }: { id: string; dueOn: string | null; note: string | null }) {
  const [state, action] = useActionState(updateAssignment.bind(null, id), {});
  return (
    <ActionForm action={action} className="space-y-4">
      <TextField label="期限（選填）" name="dueOn" type="date" defaultValue={dueOn ?? ""} />
      <TextArea label="給學生的話（選填）" name="note" maxLength={200} rows={2} defaultValue={note ?? ""} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…" variant="secondary">
        儲存
      </SubmitButton>
    </ActionForm>
  );
}
