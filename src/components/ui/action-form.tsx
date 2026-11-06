"use client";

import { createContext, useTransition, type ComponentProps, type FormEvent } from "react";

export const FormPendingContext = createContext(false);

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
};

/**
 * 表單以 action 屬性送出時，React 會在完成後清空所有欄位。
 * 驗證失敗時老師不該重填，所以改由這裡送出；成功後要清空的表單再自行 reset。
 */
export function ActionForm({ action, children, ...props }: Props) {
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  }

  return (
    <FormPendingContext.Provider value={pending}>
      <form onSubmit={submit} {...props}>
        {children}
      </form>
    </FormPendingContext.Provider>
  );
}
