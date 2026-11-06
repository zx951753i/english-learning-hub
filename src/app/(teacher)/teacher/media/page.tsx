import type { Metadata } from "next";
import { Card, EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/features/auth/session";
import { deleteImage } from "@/features/media/actions";
import { signImages } from "@/features/media/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MediaUploader } from "./media-uploader";

export const metadata: Metadata = { title: "媒體庫" };

const ERRORS: Record<string, string> = {
  used: "這張圖片還有題目在使用，無法刪除。",
  delete: "刪除失敗，請稍後再試。",
};

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireTeacher();
  const { error } = await searchParams;
  const admin = createAdminClient();
  const { data: assets } = await admin
    .from("media_assets")
    .select("id, file_name")
    .order("file_name");
  const urls = await signImages(admin, assets?.map((asset) => asset.file_name) ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">媒體庫</h1>
      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}
      <Card>
        <MediaUploader />
      </Card>
      <p className="text-sm text-muted">請使用自製或有授權的圖片，不要掃描課本內容。</p>
      {!assets || assets.length === 0 ? (
        <EmptyState title="還沒有圖片" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="space-y-2 p-3">
              {urls.get(asset.file_name) ? (
                // eslint-disable-next-line @next/next/no-img-element -- 私有限時連結，不經過圖片最佳化
                <img src={urls.get(asset.file_name)} alt={asset.file_name} className="aspect-square w-full object-contain" />
              ) : null}
              <p className="break-all text-sm">{asset.file_name}</p>
              <form action={deleteImage.bind(null, asset.id)}>
                <SubmitButton variant="ghost" pendingText="刪除中…" aria-label={`刪除 ${asset.file_name}`}>
                  刪除
                </SubmitButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
