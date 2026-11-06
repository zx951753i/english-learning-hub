"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useEffect, useRef } from "react";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createUnit, updateTextbook } from "@/features/textbooks/actions";
import { TextbookFields } from "../textbook-fields";

type Book = {
  id: string;
  title: string;
  publisher: string | null;
  series: string | null;
  grade: string | null;
  kind: string;
};

export function TextbookEditor({ book }: { book: Book }) {
  const [state, action] = useActionState(updateTextbook.bind(null, book.id), {});
  return (
    <ActionForm action={action} className="space-y-4">
      <TextbookFields values={book} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…">儲存</SubmitButton>
    </ActionForm>
  );
}

export function AddUnitForm({ textbookId }: { textbookId: string }) {
  const [state, action] = useActionState(createUnit.bind(null, textbookId), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.saved) form.current?.reset();
  }, [state]);

  return (
    <ActionForm ref={form} action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <TextField label="新增單元" name="title" required maxLength={120} autoComplete="off" />
        </div>
        <SubmitButton variant="secondary" pendingText="新增中…">
          新增
        </SubmitButton>
      </div>
      {state.error ? <Notice>{state.error}</Notice> : null}
    </ActionForm>
  );
}
