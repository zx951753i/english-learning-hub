"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useMemo, useState } from "react";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImageField } from "@/features/media/image-field";
import { saveQuestion } from "@/features/question-bank/actions";
import {
  CONTENT_TYPES,
  EXAM_BANDS,
  getContentType,
  SOURCE_TYPES,
  type ContentTypeKey,
  type Values,
} from "@/features/question-bank/content-types";
import type { StageOption, TextbookOption } from "@/features/question-bank/data";

export type QuestionFormValues = {
  id?: string;
  textbookId: string;
  unitId: string;
  topicId?: string | null;
  passageId?: string | null;
  contentType: ContentTypeKey;
  difficulty?: number;
  examBand?: string | null;
  explanation?: string | null;
  sourceType?: string;
  sourceNote?: string | null;
  confirmed?: boolean;
  fields?: Values;
};

type Props = {
  stages: StageOption[];
  textbooks: TextbookOption[];
  initial: QuestionFormValues;
  mediaNames: { images: string[]; audio: string[] };
};

export function QuestionForm({ stages, textbooks, initial, mediaNames }: Props) {
  const [state, action] = useActionState(saveQuestion.bind(null, initial.id ?? null), {});
  const [textbookId, setTextbookId] = useState(initial.textbookId);
  const [unitId, setUnitId] = useState(initial.unitId);
  const [contentType, setContentType] = useState<ContentTypeKey>(initial.contentType);

  const book = textbooks.find((item) => item.id === textbookId);
  const unit = book?.units.find((item) => item.id === unitId);
  const stage = stages.find((item) => item.id === book?.stage_id);
  const type = getContentType(contentType)!;

  const grouped = useMemo(
    () =>
      stages.map((item) => ({
        stage: item,
        books: textbooks.filter((candidate) => candidate.stage_id === item.id),
      })),
    [stages, textbooks],
  );

  return (
    <ActionForm action={action} className="space-y-5">
      <datalist id="media-names">
        {mediaNames.images.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="audio-names">
        {mediaNames.audio.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <fieldset className="space-y-4">
        <legend className="mb-2 font-serif text-xl font-semibold text-navy">題目位置</legend>
        <SelectField
          label="教材"
          required
          value={textbookId}
          onChange={(event) => {
            setTextbookId(event.target.value);
            setUnitId("");
          }}
        >
          <option value="" disabled>
            請選擇
          </option>
          {grouped.map(({ stage: item, books }) => (
            <optgroup key={item.id} label={item.name}>
              {books.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="單元"
            name="unitId"
            required
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
          >
            <option value="" disabled>
              請選擇
            </option>
            {book?.units.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </SelectField>
          <SelectField label="主題（選填）" name="topicId" key={`topic-${unitId}`} defaultValue={initial.topicId ?? ""}>
            <option value="">未指定</option>
            {unit?.learning_topics.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="mb-2 font-serif text-xl font-semibold text-navy">題目內容</legend>
        <SelectField
          label="題目類型"
          name="contentType"
          required
          hint={type.description}
          value={contentType}
          onChange={(event) => setContentType(event.target.value as ContentTypeKey)}
        >
          {CONTENT_TYPES.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </SelectField>

        {type.fields.map((field) => {
          const shared = {
            key: `${contentType}-${field.key}`,
            label: field.required || field.conditional ? field.label : `${field.label}（選填）`,
            name: `field_${field.key}`,
            hint: field.hint,
            required: field.required,
            defaultValue: initial.contentType === contentType ? initial.fields?.[field.key] : undefined,
          };
          if (field.image || field.audio) {
            return (
              <ImageField
                key={shared.key}
                label={shared.label}
                name={shared.name}
                hint={shared.hint}
                defaultValue={shared.defaultValue}
                listId={field.audio ? "audio-names" : "media-names"}
                kind={field.audio ? "audio" : "image"}
              />
            );
          }
          if (field.options) {
            return (
              <SelectField {...shared} key={shared.key} defaultValue={shared.defaultValue ?? ""}>
                <option value="" disabled>
                  請選擇
                </option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
            );
          }
          return field.multiline ? (
            <TextArea {...shared} key={shared.key} />
          ) : (
            <TextField {...shared} key={shared.key} autoComplete="off" />
          );
        })}

        {type.usesPassage ? (
          <SelectField label="連結文章（選填）" name="passageId" key={`passage-${unitId}`} defaultValue={initial.passageId ?? ""}>
            <option value="">不連結</option>
            {unit?.passages.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </SelectField>
        ) : null}

        <TextArea label="中文解析（選填）" name="explanation" maxLength={2000} defaultValue={initial.explanation ?? ""} />
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="mb-2 font-serif text-xl font-semibold text-navy">分類與來源</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="難度"
            name="difficulty"
            required
            key={`difficulty-${stage?.id}`}
            defaultValue={initial.difficulty ? String(initial.difficulty) : ""}
          >
            <option value="" disabled>
              請選擇
            </option>
            {(stage?.difficulty_labels ?? ["1", "2", "3", "4"]).map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </SelectField>
          {book?.kind === "exam_prep" ? (
            <SelectField label="會考分級（選填）" name="examBand" defaultValue={initial.examBand ?? ""}>
              <option value="">未指定</option>
              {EXAM_BANDS.map((band) => (
                <option key={band} value={band}>
                  {band}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="題目來源" name="sourceType" required defaultValue={initial.sourceType ?? ""}>
            <option value="" disabled>
              請選擇
            </option>
            {SOURCE_TYPES.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
              </option>
            ))}
          </SelectField>
          <TextField label="來源說明（選填）" name="sourceNote" maxLength={300} defaultValue={initial.sourceNote ?? ""} />
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-control bg-sky/50 px-3">
          <input
            type="checkbox"
            name="confirmed"
            defaultChecked={initial.confirmed}
            className="size-5 accent-[var(--navy)]"
          />
          <span>我已確認題目與答案，可開放使用</span>
        </label>
      </fieldset>

      {state.errors?.length ? (
        <div role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger">
          <ul className="list-inside list-disc">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {textbooks.length === 0 ? <Notice>請先到「教材」新增教材與單元。</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="儲存中…">儲存題目</SubmitButton>
        {!initial.id ? (
          <SubmitButton variant="secondary" name="intent" value="next" pendingText="儲存中…">
            儲存並新增下一題
          </SubmitButton>
        ) : null}
      </div>
    </ActionForm>
  );
}
