import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "批次建立學生" };

export default async function ImportStudentsPage() {
  await requireTeacher();
  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("is_archived", false)
    .order("name");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl">批次建立學生</h1>
      <Card>
        <ImportForm classes={classes ?? []} />
      </Card>
    </div>
  );
}
