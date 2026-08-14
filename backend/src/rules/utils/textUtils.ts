export interface ParsedDate {
  year: string;
  month: string;
  day: string;
  padded6: string;
}

export interface ParsedPhone {
  area: string;
  city: string;
  num: string;
}

export interface ParsedZip {
  first: string;
  last: string;
}

/**
 * 全角英数字・記号を半角に変換する
 */
export function toHalfWidth(str: string = ""): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/ー|−|―/g, "-")
    .trim();
}

/**
 * ひな型テキスト（キー: 値）を連想配列に変換する
 * (例: 123-4567) のようなカッコ内のコロンを無視し、正しい区切りコロンで分割します
 */
export function parseInputText(text: string = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text) return result;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("【") ||
      trimmed.startsWith("■") ||
      trimmed.startsWith("===") ||
      trimmed.startsWith("---")
    ) {
      continue;
    }

    // カッコの外にある区切りコロン（: または ：）を探す
    let colonIdx = -1;
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (char === "(" || char === "（") {
        depth++;
      } else if (char === ")" || char === "）") {
        if (depth > 0) depth--;
      } else if ((char === ":" || char === "：") && depth === 0) {
        colonIdx = i;
        break; // カッコ外の最初の区切りコロンを発見！
      }
    }

    if (colonIdx !== -1) {
      const key = trimmed.substring(0, colonIdx).trim();
      const val = trimmed.substring(colonIdx + 1).trim();
      if (key) {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * キーバリューオブジェクトから値を取得する
 */
export function getVal(rawInput: Record<string, string>, keys: string | string[]): string {
  if (!rawInput) return "";

  const keyList = Array.isArray(keys) ? keys : [keys];

  const clean = (s: string) =>
    s.replace(/[\s\u3000]/g, "").replace(/（/g, "(").replace(/）/g, ")");

  const stripParens = (s: string) => clean(s).replace(/\([^)]*\)/g, "");

  for (const key of keyList) {
    if (!key) continue;

    // 1. 完全一致
    if (rawInput[key] !== undefined && rawInput[key].trim() !== "") {
      return rawInput[key].trim();
    }

    const normQuery = clean(key);
    const baseQuery = stripParens(key);

    // 2. スペース・カッコ表記を正規化して比較
    for (const rKey of Object.keys(rawInput)) {
      const normRKey = clean(rKey);
      if (normRKey === normQuery && rawInput[rKey].trim() !== "") {
        return rawInput[rKey].trim();
      }
    }

    // 3. カッコ内をカットして比較
    for (const rKey of Object.keys(rawInput)) {
      const baseRKey = stripParens(rKey);
      if (baseQuery !== "" && baseRKey === baseQuery && rawInput[rKey].trim() !== "") {
        return rawInput[rKey].trim();
      }
    }

    // 4. 前方一致
    for (const rKey of Object.keys(rawInput)) {
      const normRKey = clean(rKey);
      if (normRKey.startsWith(normQuery) && rawInput[rKey].trim() !== "") {
        return rawInput[rKey].trim();
      }
    }
  }

  return "";
}

/**
 * 郵便番号をハイフンで前半3桁・後半4桁に分解
 */
export function parseZip(zipStr: string = ""): ParsedZip {
  const cleaned = toHalfWidth(zipStr);
  const parts = cleaned.split("-").filter((p) => p !== "");
  if (parts.length >= 2) {
    return { first: parts[0], last: parts[1] };
  }
  const digits = cleaned.replace(/[^\d]/g, "");
  if (digits.length === 7) {
    return { first: digits.substring(0, 3), last: digits.substring(3, 7) };
  }
  return { first: "", last: "" };
}

/**
 * 電話番号を市外局番・市内局番・番号に分解
 */
export function parsePhone(phoneStr: string = ""): ParsedPhone {
  const cleaned = toHalfWidth(phoneStr);
  const parts = cleaned.split(/[-ー\s()（）]/).filter((p) => p !== "");
  if (parts.length >= 3) {
    return { area: parts[0], city: parts[1], num: parts[2] };
  }

  const digits = cleaned.replace(/[^\d]/g, "");
  if (digits.length === 10) {
    if (digits.startsWith("03") || digits.startsWith("06")) {
      return { area: digits.substring(0, 2), city: digits.substring(2, 6), num: digits.substring(6, 10) };
    }
    return { area: digits.substring(0, 3), city: digits.substring(3, 6), num: digits.substring(6, 10) };
  } else if (digits.length === 11) {
    return { area: digits.substring(0, 3), city: digits.substring(3, 7), num: digits.substring(7, 11) };
  }

  return { area: "", city: "", num: "" };
}

/**
 * 様々な日付形式を分解
 */
export function parseFlexibleDate(dateStr: string = ""): ParsedDate {
  const cleaned = toHalfWidth(dateStr);
  if (!cleaned) return { year: "", month: "", day: "", padded6: "" };

  let y = "", m = "", d = "";

  const kanjiMatch = cleaned.match(/(?:令和|平成|昭和|R|H|S)?\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/i);
  if (kanjiMatch) {
    y = kanjiMatch[1];
    m = kanjiMatch[2];
    d = kanjiMatch[3];
  } else {
    const parts = cleaned.split(/[-./\s]/).filter((p) => p !== "");
    if (parts.length >= 3) {
      y = parts[0];
      m = parts[1];
      d = parts[2];
    } else {
      const digits = cleaned.replace(/[^\d]/g, "");
      if (digits.length === 6) {
        y = digits.substring(0, 2);
        m = digits.substring(2, 4);
        d = digits.substring(4, 6);
      } else if (digits.length === 8) {
        y = digits.substring(2, 4);
        m = digits.substring(4, 6);
        d = digits.substring(6, 8);
      }
    }
  }

  const trimZero = (val: string) => (val ? String(parseInt(val, 10)) : "");
  const padZero = (val: string) => (val ? String(parseInt(val, 10)).padStart(2, "0") : "00");

  return {
    year: trimZero(y),
    month: trimZero(m),
    day: trimZero(d),
    padded6: y && m && d ? `${padZero(y)}${padZero(m)}${padZero(d)}` : "",
  };
}

/**
 * 指定病院等名称から末尾の「病院・診療所・薬局・クリニック」を削除
 */
export function stripHospitalSuffix(name: string = ""): string {
  return name.replace(/(病院|診療所|薬局|クリニック)$/, "").trim();
}

/**
 * マス目印字用
 */
export function padGridValue(val: string = "", length: number): string {
  const cleaned = toHalfWidth(val).replace(/[^\d]/g, "");
  return cleaned.padEnd(length, " ");
}

/**
 * 長文の自動折り返し
 */
export function wrapText(text: string = "", maxChars: number): string {
  if (!text) return "";
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.substring(i, i + maxChars));
  }
  return lines.join("\n");
}
