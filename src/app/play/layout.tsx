import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { getCurrentProfile, homePathFor } from "@/features/auth/session";

export default async function PlayLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto max-w-xl px-4 py-3">
          <Link href={homePathFor(profile.role)} aria-label="回到首頁">
            <Logo />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
