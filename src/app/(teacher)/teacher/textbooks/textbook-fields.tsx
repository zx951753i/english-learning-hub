import { SelectField, TextField } from "@/components/ui/field";

type Values = {
  title?: string;
  publisher?: string | null;
  series?: string | null;
  grade?: string | null;
  kind?: string;
};

export function TextbookFields({ values = {} }: { values?: Values }) {
  return (
    <>
      <TextField label="教材名稱" name="title" required maxLength={120} defaultValue={values.title} autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="出版社（選填）" name="publisher" maxLength={60} defaultValue={values.publisher ?? ""} />
        <TextField label="系列（選填）" name="series" maxLength={60} defaultValue={values.series ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="年級（選填）" name="grade" maxLength={30} defaultValue={values.grade ?? ""} />
        <SelectField label="類型" name="kind" defaultValue={values.kind ?? "textbook"}>
          <option value="textbook">一般教材</option>
          <option value="exam_prep">考試專區</option>
          <option value="custom">自編教材</option>
        </SelectField>
      </div>
    </>
  );
}
