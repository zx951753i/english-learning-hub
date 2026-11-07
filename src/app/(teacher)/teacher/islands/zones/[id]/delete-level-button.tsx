"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteLevel } from "@/features/adventure/admin-actions";

/** 按兩次才刪除：第一次顯示「確定刪除」，避免誤觸。 */
export function DeleteLevelButton({ levelId, zoneId, title }: { levelId: string; zoneId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`刪除 ${title}`}
        className="inline-flex min-h-11 items-center rounded-control px-2.5 text-muted hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={18} aria-hidden />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <form action={deleteLevel.bind(null, levelId, zoneId, "zone")}>
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
