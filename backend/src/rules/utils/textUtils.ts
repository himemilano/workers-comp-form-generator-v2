export interface ParsedDate {
  era: string;          // 例: "令和"
  year: string;         // 例: "8"
  yearWithEra: string;  // 例: "令和8"（元号＋数字）
  month: string;        // 例: "8"
  day: string;          // 例: "29"
  padded6: string;      // 例: "080829"
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
 * ひな型由来の「) :」などのゴミ混入を全自動で除外・クレンジングします
 */
export function getVal(rawInput: Record<string, string>, keys: string | string[]): string {
  if (!rawInput) return "";

  const keyList = Array.isArray(keys) ? keys : [keys];

  // ひな型注記のコロン分割によるゴミ（例: "123-4567) : 611-0011"）を除去する
  const cleanValue = (val: string): string => {
    if (!val) return "";
    let s = val.trim();
    if (s.includes("):") || s.includes("）：") || s.includes(") :") || s.includes("） :")) {
      const parts = s.split(/[\)）]\s*[:：]\s*/);
      s = parts[parts.length - 1].trim();
    }
    return s;
  };

  const stripParensAndSpace = (s: string) =>
    s.replace(/[\s\u3000]/g, "").replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "");

  for (const queryKey of keyList) {
    if (!queryKey) continue;

    const cleanQuery = stripParensAndSpace(queryKey);

    for (const [rKey, rVal] of Object.entries(rawInput)) {
      const cleanRKey = stripParensAndSpace(rKey);

      if (
        cleanRKey === cleanQuery ||
        cleanRKey.startsWith(cleanQuery) ||
        cleanQuery.startsWith(cleanRKey)
      ) {
        const extracted = cleanValue(rVal);
        if (extracted !== "") {
          return extracted;
        }
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
 * 日付形式を分解（元号＋数字の yearWithEra も生成）
 */
export function parseFlexibleDate(dateStr: string = ""): ParsedDate {
  const cleaned = toHalfWidth(dateStr);
  if (!cleaned) return { era: "", year: "", yearWithEra: "", month: "", day: "", padded6: "" };

  let era = "";
  let y = "", m = "", d = "";

  // 漢字での和暦パターン（例: "令和8年8月29日", "R8年8月29日"）
  const kanjiMatch = cleaned.match(/^(?:(令和|平成|昭和|R|H|S)\s*)?(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/i);
  if (kanjiMatch) {
    era = kanjiMatch[1] || "";
    y = kanjiMatch[2];
    m = kanjiMatch[3];
    d = kanjiMatch[4];
  } else {
    // 元号記号付きかチェック
    const eraMatch = cleaned.match(/^(令和|平成|昭和|R|H|S)\s*/i);
    let dateBody = cleaned;
    if (eraMatch) {
      era = eraMatch[1];
      dateBody = cleaned.replace(/^(令和|平成|昭和|R|H|S)\s*/i, "");
    }

    const parts = dateBody.split(/[-./\s]/).filter((p) => p !== "");
    if (parts.length >= 3) {
      y = parts[0];
      m = parts[1];
      d = parts[2];
    } else {
      const digits = dateBody.replace(/[^\d]/g, "");
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

  const trimmedY = trimZero(y);
  const yearWithEra = era ? `${era}${trimmedY}` : trimmedY;

  return {
    era,
    year: trimmedY,
    yearWithEra,
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
