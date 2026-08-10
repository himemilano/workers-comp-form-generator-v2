import { RawInputData } from "../../types/form";

/**
 * 全角英数字を半角に変換し、数字・英字以外の不要な記号を除去します
 */
export function toHalfWidth(str: string): string {
  if (!str) return "";
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9a-zA-Z]/g, "");
}

/**
 * rawInput から指定キーの値を取得（コロン「:」「：」がある場合はそれ以降の値を安全に抽出）
 */
export function getVal(rawInput: RawInputData, key: string): string {
  const raw = rawInput[key] || "";
  if (!raw) return "";
  const colonIndex = Math.max(raw.indexOf("："), raw.indexOf(":"));
  const value = colonIndex !== -1 ? raw.substring(colonIndex + 1) : raw;
  return value.trim();
}

/**
 * マス目（OCR枠）用：指定桁数へゼロ埋め・フォーマット処理
 */
export function padGridValue(val: string, length: number): string {
  const clean = toHalfWidth(val);
  if (!clean) return "".padStart(length, " ");
  return clean.padStart(length, "0").slice(-length);
}

/**
 * 電話番号を市外局番・市内局番・加入者番号の3つの要素に分解します
 */
export function parsePhone(phoneStr: string): { area: string; city: string; num: string } {
  if (!phoneStr) {
    return { area: "", city: "", num: "" };
  }
  const clean = phoneStr.replace(/[^\d-]/g, "");
  const parts = clean.split("-");
  if (parts.length === 3) {
    return { area: parts[0], city: parts[1], num: parts[2] };
  }
  const digits = toHalfWidth(phoneStr);
  if (digits.length === 10) {
    return { area: digits.slice(0, 3), city: digits.slice(3, 6), num: digits.slice(6) };
  } else if (digits.length === 11) {
    return { area: digits.slice(0, 3), city: digits.slice(3, 7), num: digits.slice(7) };
  }
  return { area: digits, city: "", num: "" };
}

/**
 * 郵便番号を 前3桁 - 後4桁 に分割します
 */
export function parseZip(zipStr: string): { first: string; last: string } {
  const digits = toHalfWidth(zipStr);
  if (!digits) {
    return { first: "", last: "" };
  }
  return {
    first: digits.slice(0, 3),
    last: digits.slice(3, 7)
  };
}

/**
 * 日本語日付表記（和暦・数字・6桁形式）を 年・月・日 の要素に分解します
 */
export function parseFlexibleDate(dateStr: string): { year: string; month: string; day: string } {
  if (!dateStr) return { year: "", month: "", day: "" };

  const digits = toHalfWidth(dateStr);
  
  if (/^\d{6}$/.test(digits)) {
    return {
      year: digits.slice(0, 2),
      month: digits.slice(2, 4),
      day: digits.slice(4, 6)
    };
  }

  const matches = dateStr.match(/(?:昭和|平成|令和)?\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (matches) {
    return {
      year: matches[1].padStart(2, "0"),
      month: matches[2].padStart(2, "0"),
      day: matches[3].padStart(2, "0")
    };
  }

  return { year: "", month: "", day: "" };
}

/**
 * 長文テキストの枠超過防止：指定文字数ごとに \n（改行コード）を自動挿入します
 */
export function wrapText(text: string, maxCharsPerLine: number = 30): string {
  if (!text) return "";
  const cleanText = text.replace(/\r?\n/g, "");
  const regex = new RegExp(`.{1,${maxCharsPerLine}}`, "g");
  const lines = cleanText.match(regex);
  return lines ? lines.join("\n") : cleanText;
}
