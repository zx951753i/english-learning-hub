import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { logout } from "@/features/auth/actions";

export function StudentHeader() {
  return (
    <header className="border-b-2 border-[#EADFCB] bg-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/home" aria-label="回到冒險地圖">
          <Logo />
        </Link>
        <form action={logout} className="no-print">
          <Button type="submit" variant="ghost" aria-label="登出">
            <LogOut size={18} aria-hidden />
            <span className="hidden sm:inline">登出</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
