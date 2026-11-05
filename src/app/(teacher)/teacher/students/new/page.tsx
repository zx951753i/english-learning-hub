import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { StudentForm } from "./student-form";

export const metadata: Metadata = { title: "新增學生" };

export default async function NewStudentPage() {
  await requireTeacher();
  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("is_archived", false)
    .order("name");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl">新增學生</h1>
      <Card>
        <StudentForm classes={classes ?? []} />
      </Card>
    </div>
  );
}
