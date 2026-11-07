"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/features/auth/session";
import {
  detectMedia,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  MEDIA_BUCKET,
  normalizeFileName,
  type MediaKind,
} from "@/features/media/rules";
import { createAdminClient } from "@/lib/supabase/admin";

export type UploadResult = { ok: true; fileName: string } | { ok: false; error: string };

/**
 * 一次一個檔案：Vercel 單次請求約 4.5 MB，由瀏覽器逐一送出。
 * expect 指定只接受圖片或音檔（題目欄位用）；未指定時兩者皆可（媒體庫）。
 */
export async function uploadMedia(formData: FormData, expect?: MediaKind): Promise<UploadResult> {
  const profile = await requireTeacher();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "請選擇檔案。" };

  const fileName = normalizeFileName(file.name);
  if (!fileName) return { ok: false, error: "檔名不正確。" };
  if (file.size > MAX_AUDIO_BYTES) return { ok: false, error: `${fileName} 超過 4 MB。` };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectMedia(bytes);
  if (!image || (expect && image.kind !== expect)) {
    const wanted =
      expect === "image" ? "PNG、JPG、WebP 或 GIF 圖片" : expect === "audio" ? "MP3、M4A 或 WAV 音檔" : "支援的圖片或音檔";
    return { ok: false, error: `${fileName} 不是${wanted}。` };
  }
  if (image.kind === "image" && file.size > MAX_IMAGE_BYTES) return { ok: false, error: `${fileName} 超過 2 MB。` };

  const admin = createAdminClient();
  const storagePath = `${crypto.randomUUID()}.${image.ext}`;
  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: image.mime });
  if (uploadError) return { ok: false, error: `${fileName} 上傳失敗。` };

  const { data: existing } = await admin
    .from("media_assets")
    .select("storage_path")
    .eq("file_name", fileName)
    .maybeSingle();

  const { error } = await admin.from("media_assets").upsert(
    {
      file_name: fileName,
      storage_path: storagePath,
      mime_type: image.mime,
      size_bytes: bytes.length,
      created_by: profile.id,
    },
    { onConflict: "file_name" },
  );
  if (error) {
    await admin.storage.from(MEDIA_BUCKET).remove([storagePath]);
    return { ok: false, error: `${fileName} 儲存失敗。` };
  }
  if (existing) await admin.storage.from(MEDIA_BUCKET).remove([existing.storage_path]);

  revalidatePath("/teacher", "layout");
  return { ok: true, fileName };
}

/** 題目欄位的「上傳新圖片」。 */
export async function uploadImage(formData: FormData) {
  return uploadMedia(formData, "image");
}

export async function uploadAudio(formData: FormData) {
  return uploadMedia(formData, "audio");
}

export async function deleteImage(id: string) {
  await requireTeacher();
  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("media_assets")
    .select("file_name, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!asset) redirect("/teacher/media");

  const { data: inUse, error } = await admin.rpc("media_in_use", { p_file_name: asset.file_name });
  if (error) redirect("/teacher/media?error=delete");
  if (inUse) redirect("/teacher/media?error=used");

  await admin.from("media_assets").delete().eq("id", id);
  await admin.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
  revalidatePath("/teacher", "layout");
  redirect("/teacher/media");
}
