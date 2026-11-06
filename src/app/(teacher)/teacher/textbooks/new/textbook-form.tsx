"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTextbook } from "@/features/textbooks/actions";
import { TextbookFields } from "../textbook-fields";

export function TextbookForm({ stages }: { stages: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createTextbook, {});
  return (
    <ActionForm action={action} className="space-y-4">
      <SelectField
        label="學習階段"
        name="stageId"
        required
        defaultValue=""
        hint="建立後不可更改，三個階段的教材與題目互相獨立"
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
      <TextbookFields />
      <TextField
        label="先建立幾個單元"
        name="unitCount"
        type="number"
        min={0}
        max={60}
        defaultValue={8}
        hint="會產生 Unit 1、Unit 2…，之後可以改名；填 0 則不建立"
      />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <SubmitButton pendingText="建立中…">建立教材</SubmitButton>
    </ActionForm>
  );
}
