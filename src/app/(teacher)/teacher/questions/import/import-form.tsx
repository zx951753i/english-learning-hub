"use client";

import { ActionForm } from "@/components/ui/action-form";
import { Download } from "lucide-react";
import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { previewImport } from "@/features/question-bank/actions";
import { CONTENT_TYPES } from "@/features/question-bank/content-types";

type Props = {
  stages: { id: string; name: string }[];
  textbooks: { id: string; title: string; stage_id: string }[];
};

export function QuestionImportForm({ stages, textbooks }: Props) {
  const [state, action] = useActionState(previewImport, {});
  const [typeKey, setTypeKey] = useState("vocab_item");

  return (
    <ActionForm action={action} className="space-y-4">
      <SelectField label="教材" name="textbookId" required defaultValue="">
        <option value="" disabled>
          請選擇
        </option>
        {stages.map((stage) => (
          <optgroup key={stage.id} label={stage.name}>
            {textbooks
              .filter((book) => book.stage_id === stage.id)
              .map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
          </optgroup>
        ))}
      </SelectField>
      <SelectField
        label="題目類型"
        name="contentType"
        required
        value={typeKey}
        onChange={(event) => setTypeKey(event.target.value)}
        hint="每個檔案只放一種題目類型，範本欄位會不同"
      >
        {CONTENT_TYPES.map((type) => (
          <option key={type.key} value={type.key}>
            {type.label}
          </option>
        ))}
      </SelectField>
      <a href={`/teacher/questions/import/template/${typeKey}`} className={buttonClass("secondary")}>
        <Download size={18} aria-hidden />
        下載 Excel 範本
      </a>
      <TextField
        label="Excel 或 CSV 檔案"
        name="file"
        type="file"
        accept=".xlsx,.csv"
        required
        hint="「單元」要與教材內的單元名稱相同；難度填 1–4 或該階段的難度名稱。一次最多 1000 題。"
        className="w-full py-2"
      />
      {state.errors?.length ? (
        <div role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger">
          <ul className="list-inside list-disc">
            {state.errors.map((error, index) => (
              <li key={index}>
                {error.line > 0 ? `第 ${error.line} 列：` : ""}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <SubmitButton pendingText="讀取中…">上傳並預覽</SubmitButton>
    </ActionForm>
  );
}
