/**
 * 自然發音題的「字母或字母組合」正規化。
 * 老師常寫成 Oxford Phonics 的格式「Aa」「Ii」（同一字母大小寫並列），視同單一字母 a、i；
 * 其他寫法（sh、ch、ck）保留為小寫的字母組合。
 */
export function baseLetter(value: string) {
  const text = value.trim();
  const pair = /^([a-z])\1$/i.exec(text);
  if (pair && text[0] !== text[1]) return pair[1].toLowerCase();
  return text.toLowerCase();
}

/** 是否為單一英文字母（含「Aa」寫法）。 */
export const isSingleLetter = (value: string) => /^[a-z]$/.test(baseLetter(value));
