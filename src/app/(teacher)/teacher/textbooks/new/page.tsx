import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TextbookForm } from "./textbook-form";

export const metadata: Metadata = { title: "新增教材" };

export default async function NewTextbookPage() {
  await requireTeacher();
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("learning_stages")
    .select("id, name")
    .order("order_index");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl">新增教材</h1>
      <Card>
        <TextbookForm stages={stages ?? []} />
      </Card>
    </div>
  );
}
