"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createZone, updateZone, type FormState } from "@/features/adventure/admin-actions";
import { ZONE_THEMES } from "@/features/adventure/rules";

type Zone = { id: string; name: string; theme_key: string; description: string | null };

export function ZoneForm({ textbookId, zone }: { textbookId?: string; zone?: Zone }) {
  const action = zone ? updateZone.bind(null, zone.id) : createZone.bind(null, textbookId ?? "");
  const [state, submit] = useActionState<FormState, FormData>(action, {});
  return (
    <ActionForm action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="區域名稱" name="name" required maxLength={60} defaultValue={zone?.name} autoComplete="off" />
        <SelectField label="插畫主題" name="theme" required defaultValue={zone?.theme_key ?? "forest"}>
          {ZONE_THEMES.map((theme) => (
            <option key={theme.key} value={theme.key}>
              {theme.label}
            </option>
          ))}
        </SelectField>
      </div>
      <TextArea label="說明（選填）" name="description" maxLength={200} defaultValue={zone?.description ?? ""} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…">{zone ? "儲存區域" : "新增區域"}</SubmitButton>
    </ActionForm>
  );
}
