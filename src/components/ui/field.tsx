import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlClass =
  "w-full rounded-control border border-line bg-white px-3 text-ink placeholder:text-muted/70";

function Label({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

type WithLabel = { label: string; hint?: string };

export function TextField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & WithLabel) {
  return (
    <Label label={label} hint={hint}>
      <input className={`${controlClass} min-h-[var(--control-height)]`} {...props} />
    </Label>
  );
}

export function TextArea({ label, hint, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & WithLabel) {
  return (
    <Label label={label} hint={hint}>
      <textarea className={`${controlClass} py-2`} rows={3} {...props} />
    </Label>
  );
}

export function SelectField({ label, hint, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & WithLabel) {
  return (
    <Label label={label} hint={hint}>
      <select className={`${controlClass} min-h-[var(--control-height)]`} {...props}>
        {children}
      </select>
    </Label>
  );
}
