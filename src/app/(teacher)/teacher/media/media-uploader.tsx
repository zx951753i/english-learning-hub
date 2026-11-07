"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/ui/notice";
import { uploadMedia } from "@/features/media/actions";
import { AUDIO_ACCEPT, IMAGE_ACCEPT } from "@/features/media/rules";

export function MediaUploader() {
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState("");
  const [uploaded, setUploaded] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  function upload(files: File[]) {
    setUploaded(0);
    setErrors([]);
    startTransition(async () => {
      let done = 0;
      const failed: string[] = [];
      for (const [index, file] of files.entries()) {
        setProgress(`上傳中 ${index + 1} / ${files.length}`);
        const data = new FormData();
        data.set("file", file);
        const result = await uploadMedia(data);
        if (result.ok) done += 1;
        else failed.push(result.error);
      }
      setProgress("");
      setUploaded(done);
      setErrors(failed);
    });
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <span className="block font-medium">選擇圖片或音檔（可多選）</span>
        <input
          type="file"
          multiple
          disabled={pending}
          accept={`${IMAGE_ACCEPT},${AUDIO_ACCEPT}`}
          className="w-full py-2"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length > 0) upload(files);
          }}
        />
        <span className="block text-sm text-muted">
          圖片：PNG、JPG、WebP、GIF，每張 2 MB 內。音檔：MP3、M4A（iPhone 語音備忘錄）、WAV，每個 4 MB 內。
          檔名相同會取代舊檔；Excel 的圖片欄或音檔欄填這個檔名即可。
        </span>
      </label>
      {progress ? <p className="text-sm text-muted">{progress}</p> : null}
      {uploaded > 0 ? <Notice tone="ok">已上傳 {uploaded} 個檔案。</Notice> : null}
      {errors.map((error) => (
        <Notice key={error}>{error}</Notice>
      ))}
    </div>
  );
}
