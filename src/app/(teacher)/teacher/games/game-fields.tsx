import { SelectField, TextField } from "@/components/ui/field";

type Values = { title?: string; question_count?: number; difficulty_min?: number; difficulty_max?: number };

export function GameFields({ values = {}, labels }: { values?: Values; labels: string[] }) {
  const options = labels.map((label, index) => (
    <option key={label} value={index + 1}>
      {label}
    </option>
  ));
  return (
    <>
      <TextField label="遊戲名稱" name="title" required maxLength={120} defaultValue={values.title} autoComplete="off" />
      <TextField label="每局題數" name="questionCount" type="number" min={2} max={30} required defaultValue={values.question_count ?? 8} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="最低難度" name="difficultyMin" defaultValue={values.difficulty_min ?? 1}>
          {options}
        </SelectField>
        <SelectField label="最高難度" name="difficultyMax" defaultValue={values.difficulty_max ?? 4}>
          {options}
        </SelectField>
      </div>
    </>
  );
}
