"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useEffect, useRef } from "react";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { SKILLS, SOURCE_TYPES } from "@/features/question-bank/content-types";
import { savePassage, saveTopic, updateUnit } from "@/features/textbooks/actions";

export function UnitTitleForm({ id, title }: { id: string; title: string }) {
  const [state, action] = useActionState(updateUnit.bind(null, id), {});
  return (
    <ActionForm action={action} className="space-y-3">
      <TextField label="單元名稱" name="title" defaultValue={title} required maxLength={120} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…">儲存</SubmitButton>
    </ActionForm>
  );
}

type Topic = { id: string; title: string; skill: string; concept_tags: string[] };

export function TopicForm({ unitId, topic }: { unitId: string; topic?: Topic }) {
  const [state, action] = useActionState(saveTopic.bind(null, unitId, topic?.id ?? null), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.saved && !topic) form.current?.reset();
  }, [state, topic]);

  return (
    <ActionForm ref={form} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="主題名稱" name="title" defaultValue={topic?.title} required maxLength={120} autoComplete="off" />
        <SelectField label="技能類別" name="skill" defaultValue={topic?.skill ?? ""} required>
          <option value="" disabled>
            請選擇
          </option>
          {SKILLS.map((skill) => (
            <option key={skill.key} value={skill.key}>
              {skill.label}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        label="概念標籤（選填）"
        name="conceptTags"
        defaultValue={topic?.concept_tags.join(", ")}
        hint="以逗號分隔，例如 past-simple, verb-tense；標籤相同的舊題會用於螺旋複習"
      />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved && topic ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton variant="secondary" pendingText="儲存中…">
        {topic ? "儲存主題" : "新增主題"}
      </SubmitButton>
    </ActionForm>
  );
}

type Passage = {
  id: string;
  title: string;
  body: string;
  source_type: string;
  source_note: string | null;
};

export function PassageForm({ unitId, passage }: { unitId: string; passage?: Passage }) {
  const [state, action] = useActionState(savePassage.bind(null, unitId, passage?.id ?? null), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.saved && !passage) form.current?.reset();
  }, [state, passage]);

  return (
    <ActionForm ref={form} action={action} className="space-y-3">
      <TextField label="文章標題" name="title" defaultValue={passage?.title} required maxLength={120} autoComplete="off" />
      <TextArea label="文章內容" name="body" defaultValue={passage?.body} required rows={6} maxLength={20000} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="內容來源" name="sourceType" defaultValue={passage?.source_type ?? ""} required>
          <option value="" disabled>
            請選擇
          </option>
          {SOURCE_TYPES.map((source) => (
            <option key={source.key} value={source.key}>
              {source.label}
            </option>
          ))}
        </SelectField>
        <TextField label="來源說明（選填）" name="sourceNote" defaultValue={passage?.source_note ?? ""} maxLength={300} />
      </div>
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved && passage ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton variant="secondary" pendingText="儲存中…">
        {passage ? "儲存文章" : "新增文章"}
      </SubmitButton>
    </ActionForm>
  );
}
