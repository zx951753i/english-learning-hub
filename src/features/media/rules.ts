export const MEDIA_BUCKET = "question-media";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Vercel 單次請求約 4.5 MB，音檔上限 4 MB。 */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export type MediaKind = "image" | "audio";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const AUDIO_ACCEPT = "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp3,.m4a,.wav";

const SIGNATURES: { mime: string; ext: string; match: (b: Uint8Array) => boolean }[] = [
  { mime: "image/png", ext: "png", match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", ext: "jpg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", ext: "gif", match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    mime: "image/webp",
    ext: "webp",
    match: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** 依檔案內容判斷格式，不信任副檔名；SVG 可夾帶程式，不接受。 */
export const detectImage = (bytes: Uint8Array) =>
  SIGNATURES.find((signature) => signature.match(bytes)) ?? null;

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.slice(start, start + length));

const M4A_BRANDS = new Set(["M4A ", "M4B ", "mp42", "mp41", "isom", "iso2"]);

const AUDIO_SIGNATURES: { mime: string; ext: string; match: (b: Uint8Array) => boolean }[] = [
  // MP3：ID3 標籤，或沒有標籤時的 MPEG 音框同步碼
  { mime: "audio/mpeg", ext: "mp3", match: (b) => ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  // M4A（iPhone 語音備忘錄）：ISO 媒體檔，第 4–7 位元組為 ftyp
  // 只接受音訊品牌，避免 iPhone 的 HEIC 照片（同樣以 ftyp 開頭）被當成音檔
  { mime: "audio/mp4", ext: "m4a", match: (b) => ascii(b, 4, 4) === "ftyp" && M4A_BRANDS.has(ascii(b, 8, 4)) },
  { mime: "audio/wav", ext: "wav", match: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE" },
];

export const detectAudio = (bytes: Uint8Array) =>
  AUDIO_SIGNATURES.find((signature) => signature.match(bytes)) ?? null;

/** 判斷上傳檔案是圖片或音檔。 */
export function detectMedia(bytes: Uint8Array): { mime: string; ext: string; kind: MediaKind } | null {
  const image = detectImage(bytes);
  if (image) return { ...image, kind: "image" };
  const audio = detectAudio(bytes);
  return audio ? { ...audio, kind: "audio" } : null;
}

export const isAudioMime = (mime: string) => mime.startsWith("audio/");

export const normalizeFileName = (name: string) =>
  name.replace(/^.*[\\/]/, "").trim().toLowerCase().slice(0, 200);
