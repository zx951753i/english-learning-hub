"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateLevel, type FormState } from "@/features/adventure/admin-actions";
import { LevelFields } from "../../level-fields";

type Values = Parameters<typeof LevelFields>[0]["values"];

export function LevelEditor({ levelId, values, labels }: { levelId: string; values: Values; labels: string[] }) {
  const [state, submit] = useActionState<FormState, FormData>(updateLevel.bind(null, levelId), {});
  return (
    <ActionForm action={submit} className="space-y-4">
      <LevelFields values={values} labels={labels} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…">儲存</SubmitButton>
    </ActionForm>
  );
}
