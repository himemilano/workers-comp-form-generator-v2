export interface ParsedDate {
  year: string;
  month: string;
  day: string;
  padded6: string; // マス目印字用の6桁（例: 080829）
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
 * キーバリューオブジェクトから値を取得する
 * （(例: ...) の除去、スペース除去、全半角補正を自動で行い完全補正）
 */
export function getVal(rawInput: Record<string, string>, key: string): string {
  if (!rawInput) return "";

  // 1. 完全一致チェック
  if (rawInput[key] !== undefined) {
    return rawInput[key].trim();
  }

  // 2. キーの正規化関数（スペース除去、カッコ統一、(例:...) の注記を自動カット）
  const normalizeKey = (k: string) =>
    k
      .replace(/[\s\u3000]/g, "")           // 全角・半角スペースを全除去
      .replace(/（/g, "(")                   // カッコを半角に統一
      .replace(/）/g, ")")
      .replace(/\(例[:：][^)]*\)/gi, "");    // (例: ...) や (例：...) を丸ごとカット

  const targetNormalized = normalizeKey(key);

  for (const rKey of Object.keys(rawInput)) {
    if (normalizeKey(rKey) === targetNormalized) {
      return rawInput[rKey].trim();
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
 * 電話番号をハイフンまたは桁数で市外局番・市内局番・番号に分解
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
 * 様々な日付形式を分解（通常印字用は1桁そのまま、マス目用は6桁ゼロ埋め）
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
 * マス目印字用（指定桁数に合わせて空白埋め）
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
