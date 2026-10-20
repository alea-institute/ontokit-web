/**
 * Make script leakage and invisible characters visible. A reviewer must see
 * `pigmentים` as Latin + Hebrew, and a stray U+200F or U+0006 as a mark, not
 * as nothing (requirements §6.4).
 */

export interface Segment {
  text: string;
  kind: "plain" | "foreign" | "invisible";
}

/** Locales whose native script is not Latin. */
const NON_LATIN = new Set(["he", "hi", "ja", "zh", "ar", "ru", "el", "ko", "th", "uk"]);

const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f­؜​-‏‪-‮⁠-⁤⁦-⁩﻿�]/u;

/** Characters that are invisible, control or bidi formatting, plus U+FFFD. */
export function isInvisible(ch: string): boolean {
  return INVISIBLE.test(ch);
}

export function codePointLabel(ch: string): string {
  return `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Latin letters in a non-Latin locale; Cyrillic/Greek/CJK/Hebrew letters in a Latin one. */
function foreignTest(lang: string | null): ((ch: string) => boolean) | null {
  if (!lang) return null;
  const base = lang.split("-")[0].toLowerCase();
  if (NON_LATIN.has(base)) return (ch) => /\p{Script=Latin}/u.test(ch);
  return (ch) => /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch);
}

/** Split `value` into runs; joining every `text` reproduces `value` exactly. */
export function segmentScripts(value: string, lang: string | null): Segment[] {
  const foreign = foreignTest(lang);
  const out: Segment[] = [];
  for (const ch of value) {
    const kind: Segment["kind"] = isInvisible(ch) ? "invisible" : foreign?.(ch) ? "foreign" : "plain";
    const last = out[out.length - 1];
    if (last && last.kind === kind && kind !== "invisible") last.text += ch;
    else out.push({ text: ch, kind });
  }
  return out;
}

export function hasLeakage(value: string, lang: string | null): boolean {
  return segmentScripts(value, lang).some((s) => s.kind !== "plain");
}
