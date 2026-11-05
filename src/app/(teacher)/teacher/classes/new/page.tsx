import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ClassForm } from "./class-form";

export const metadata: Metadata = { title: "新增班級" };

export default async function NewClassPage() {
  await requireTeacher();
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("learning_stages")
    .select("id, name")
    .order("order_index");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl">新增班級</h1>
      <Card>
        <ClassForm stages={stages ?? []} />
      </Card>
    </div>
  );
}
