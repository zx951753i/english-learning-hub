import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET } from "@/features/media/rules";

/** 把題目裡的檔名換成一小時內有效的連結。admin 必須是已驗證權限的伺服器流程。 */
export async function signImages(admin: SupabaseClient, fileNames: string[]) {
  const names = [...new Set(fileNames.filter(Boolean))];
  const urls = new Map<string, string>();
  if (names.length === 0) return urls;

  const { data: assets } = await admin
    .from("media_assets")
    .select("file_name, storage_path")
    .in("file_name", names);
  if (!assets?.length) return urls;

  const { data: signed } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(assets.map((asset) => asset.storage_path), 3600);

  for (const asset of assets) {
    const url = signed?.find((item) => item.path === asset.storage_path)?.signedUrl;
    if (url) urls.set(asset.file_name, url);
  }
  return urls;
}
