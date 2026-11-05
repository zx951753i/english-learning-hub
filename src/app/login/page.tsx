import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { getCurrentProfile, homePathFor } from "@/features/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathFor(profile.role));

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <Logo />
      <Card>
        <h1 className="mb-1 text-2xl">歡迎回來</h1>
        <p className="mb-5 text-sm text-muted">請使用老師提供的帳號和密碼登入。</p>
        <LoginForm />
      </Card>
    </main>
  );
}
