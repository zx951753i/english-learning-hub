import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-2xl">找不到這個頁面</h1>
      <p className="text-muted">網址可能有誤，或您沒有查看這個頁面的權限。</p>
      <Link href="/" className="font-medium text-navy underline underline-offset-4">
        回到首頁
      </Link>
    </main>
  );
}
