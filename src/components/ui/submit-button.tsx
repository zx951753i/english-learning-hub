"use client";

import { useContext, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { FormPendingContext } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  pendingText = "處理中…",
  children,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const status = useFormStatus();
  const actionFormPending = useContext(FormPendingContext);
  const pending = status.pending || actionFormPending;
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? pendingText : children}
    </Button>
  );
}
