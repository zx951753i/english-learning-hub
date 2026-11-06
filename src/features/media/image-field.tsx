"use client";

import { useRef, useState, useTransition } from "react";
import { uploadImage } from "@/features/media/actions";

type Props = {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string;
  listId: string;
};

export function ImageField({ label, name, hint, defaultValue, listId }: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    const data = new FormData();
    data.set("file", file);
    setError("");
    startTransition(async () => {
      const result = await uploadImage(data);
      if (result.ok) setValue(result.fileName);
      else setError(result.error);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="block font-medium text-ink">{label}</span>
        <input
          name={name}
          list={listId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          className="min-h-[var(--control-height)] w-full rounded-control border border-line bg-white px-3 text-ink"
        />
      </label>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      <label className="inline-block cursor-pointer text-sm text-navy underline underline-offset-4">
        {pending ? "上傳中…" : "上傳新圖片"}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label={`上傳${label}`}
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
