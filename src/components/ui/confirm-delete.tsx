"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  action: () => Promise<void>;
  /** 螢幕閱讀器與按鈕上的名稱，例如「刪除 第一關」 */
  label: string;
  /** 確認時顯示的提醒 */
  warning?: string;
  /** icon：列表中的垃圾桶；button：一般按鈕 */
  variant?: "icon" | "button";
};

/** 按兩次才刪除：第一次顯示提醒與「確定刪除」，避免誤觸。 */
export function ConfirmDelete({ action, label, warning, variant = "icon" }: Props) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return variant === "icon" ? (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={label}
        className="inline-flex min-h-11 items-center rounded-control px-2.5 text-muted hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={18} aria-hidden />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-danger px-4 font-medium text-danger hover:bg-danger-soft"
      >
        <Trash2 size={18} aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <span className="flex basis-full flex-wrap items-center justify-end gap-2 sm:basis-auto">
      {warning ? <span className="text-sm text-danger">{warning}</span> : null}
      <form action={action}>
        <SubmitButton variant="danger" pendingText="刪除中…" className="px-3">
          確定刪除
        </SubmitButton>
      </form>
      <button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-2 text-sm text-muted underline">
        取消
      </button>
    </span>
  );
}
