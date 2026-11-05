"use client";

import { useActionState } from "react";
import { TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateClass } from "@/features/classes/actions";

type ClassInfo = { id: string; name: string; description: string | null };

export function ClassEditor({ item }: { item: ClassInfo }) {
  const [state, action] = useActionState(updateClass.bind(null, item.id), {});
  return (
    <form action={action} className="space-y-4">
      <TextField label="班級名稱" name="name" defaultValue={item.name} required maxLength={60} />
      <TextArea label="說明（選填）" name="description" defaultValue={item.description ?? ""} maxLength={300} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…">儲存</SubmitButton>
    </form>
  );
}
