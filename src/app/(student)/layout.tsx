import { requireStudent } from "@/features/auth/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return children;
}
