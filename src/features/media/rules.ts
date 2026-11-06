export const MEDIA_BUCKET = "question-media";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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

export const normalizeFileName = (name: string) =>
  name.replace(/^.*[\\/]/, "").trim().toLowerCase().slice(0, 200);
