"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl">暫時無法顯示這個頁面</h1>
      <p className="text-muted">請再試一次；若問題持續，請稍後回來。</p>
      <Button onClick={reset}>再試一次</Button>
    </main>
  );
}
