"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Credential } from "@/features/accounts/actions";

export function CredentialList({ credentials }: { credentials: Credential[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = credentials
      .map((item) => `${item.displayName}\t帳號：${item.username}\t密碼：${item.password}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div className="space-y-3 rounded-card border border-sky-deep/40 bg-sky/50 p-4">
      <p className="font-medium text-navy">請現在記下密碼，離開此頁後就不會再顯示。</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left">
          <thead className="text-sm text-muted">
            <tr>
              <th className="py-1 pr-4 font-medium">姓名</th>
              <th className="py-1 pr-4 font-medium">帳號</th>
              <th className="py-1 font-medium">密碼</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((item) => (
              <tr key={item.username} className="border-t border-navy/10">
                <td className="py-1.5 pr-4">{item.displayName}</td>
                <td className="py-1.5 pr-4 font-mono text-sm">{item.username}</td>
                <td className="py-1.5 font-mono text-sm">{item.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="no-print flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          {copied ? "已複製" : "複製"}
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={18} aria-hidden />
          列印
        </Button>
      </div>
    </div>
  );
}
