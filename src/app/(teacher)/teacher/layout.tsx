import {
  BookOpen,
  FileQuestion,
  Gamepad2,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { logout } from "@/features/auth/actions";
import { requireTeacher } from "@/features/auth/session";

const navItems = [
  { href: "/teacher", label: "總覽", icon: LayoutDashboard },
  { href: "/teacher/students", label: "學生", icon: Users },
  { href: "/teacher/classes", label: "班級", icon: UsersRound },
  { href: "/teacher/textbooks", label: "教材", icon: BookOpen },
  { href: "/teacher/questions", label: "題庫", icon: FileQuestion },
  { href: "/teacher/media", label: "媒體", icon: ImageIcon },
  { href: "/teacher/games", label: "遊戲", icon: Gamepad2 },
];

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireTeacher();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="no-print border-b border-line bg-paper lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:py-5">
          <Link href="/teacher">
            <Logo />
          </Link>
          <form action={logout} className="lg:hidden">
            <Button type="submit" variant="ghost" aria-label="登出">
              <LogOut size={18} aria-hidden />
            </Button>
          </form>
        </div>
        <nav aria-label="老師後台" className="flex gap-0.5 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:px-3 lg:pb-0">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 shrink-0 items-center gap-1 rounded-control px-1.5 text-[15px] font-medium text-ink hover:bg-sky hover:text-navy sm:gap-2.5 sm:px-3 sm:text-base"
            >
              <Icon size={16} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-line p-3 lg:block">
          <p className="px-2 pb-2 text-sm text-muted">{profile.display_name}</p>
          <form action={logout}>
            <Button type="submit" variant="ghost" className="w-full justify-start">
              <LogOut size={18} aria-hidden />
              登出
            </Button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
