"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClass } from "@/features/classes/actions";

export function ClassForm({ stages }: { stages: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createClass, {});
  return (
    <ActionForm action={action} className="space-y-4">
      <TextField label="班級名稱" name="name" required maxLength={60} autoComplete="off" />
      <SelectField
        label="學習階段"
        name="stageId"
        required
        defaultValue=""
        hint="建立後不可更改，避免不同階段的教材混用"
      >
        <option value="" disabled>
          請選擇
        </option>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </SelectField>
      <TextArea label="說明（選填）" name="description" maxLength={300} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <SubmitButton pendingText="建立中…">建立班級</SubmitButton>
    </ActionForm>
  );
}
