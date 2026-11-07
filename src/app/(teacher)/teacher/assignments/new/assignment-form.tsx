"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createAssignments } from "@/features/assignments/actions";

type Props = {
  groups: { label: string; levels: { id: string; title: string }[] }[];
  classes: { id: string; name: string }[];
  students: { id: string; name: string; username: string }[];
  defaultLevel?: string;
};

export function AssignmentForm({ groups, classes, students, defaultLevel }: Props) {
  const [state, action] = useActionState(createAssignments, {});
  const [target, setTarget] = useState<"class" | "student">("class");

  return (
    <ActionForm action={action} className="space-y-5">
      <SelectField label="關卡" name="levelId" required defaultValue={defaultLevel ?? ""} hint="只列出已發布的關卡">
        <option value="" disabled>
          請選擇
        </option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.title}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-medium">指派給</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="指派對象類型">
          {(["class", "student"] as const).map((kind) => (
            <label
              key={kind}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-4 ${
                target === kind ? "border-navy bg-sky text-navy" : "border-line bg-paper"
              }`}
            >
              <input
                type="radio"
                name="targetType"
                value={kind}
                checked={target === kind}
                onChange={() => setTarget(kind)}
                className="size-4"
              />
              {kind === "class" ? "班級" : "個別學生"}
            </label>
          ))}
        </div>
        <div className="grid max-h-72 gap-1.5 overflow-y-auto rounded-control border border-line p-3 sm:grid-cols-2">
          {target === "class"
            ? classes.map((item) => (
                <label key={item.id} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="classId" value={item.id} className="size-4" />
                  {item.name}
                </label>
              ))
            : students.map((item) => (
                <label key={item.id} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="studentId" value={item.id} className="size-4" />
                  {item.name}
                  <span className="text-sm text-muted">{item.username}</span>
                </label>
              ))}
          {(target === "class" ? classes : students).length === 0 ? (
            <p className="text-sm text-muted">{target === "class" ? "還沒有班級。" : "還沒有學生。"}</p>
          ) : null}
        </div>
      </fieldset>

      <TextField label="期限（選填）" name="dueOn" type="date" hint="期限當天結束前完成都算準時" />
      <TextArea label="給學生的話（選填）" name="note" maxLength={200} rows={2} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <SubmitButton pendingText="建立中…">建立任務</SubmitButton>
    </ActionForm>
  );
}
