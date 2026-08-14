export interface ParsedDate {
  era: string;
  year: string;
  yearWithEra: string;
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

export function toHalfWidth(str: string = ""): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/ー|−|―/g, "-")
    .trim();
}

/**
 * カタカナの濁点・半濁点を独立した文字 ("゛", "゜") に分離する
 */
export function splitKatakanaDakuon(str: string = ""): string[] {
  const result: string[] = [];
  const normalized = str.normalize("NFD");
  for (const char of normalized) {
    if (char === "\u3099") result.push("゛");
    else if (char === "\u309A") result.push("゜");
    else result.push(char);
  }
  return result;
}

export function formatKatakanaWithDakuon(str: string = ""): string {
  return splitKatakanaDakuon(str).join("");
}

/**
 * キー判定用の正規化処理
 * (カッコ注記、空白、全半角の違いを除去して純粋なキー名を取り出す)
 */
function cleanKey(s: string): string {
  if (!s) return "";
  return s
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

/**
 * キーバリューから値を厳格取得（ベースキー名の完全一致のみ）
 */
export function getVal(rawInput: Record<string, string>, keys: string | string[]): string {
  if (!rawInput) return "";

  const keyList = Array.isArray(keys) ? keys : [keys];

  const cleanValue = (val: string): string => {
    if (!val) return "";
    let s = val.trim();
    if (s.includes("):") || s.includes("）：") || s.includes(") :") || s.includes("） :")) {
      const parts = s.split(/[\)）]\s*[:：]\s*/);
      s = parts[parts.length - 1].trim();
    }
    return s;
  };

  for (const queryKey of keyList) {
    if (!queryKey) continue;
    const targetKey = cleanKey(queryKey);

    for (const [rKey, rVal] of Object.entries(rawInput)) {
      const currentKey = cleanKey(rKey);

      // 部分一致(includes)ではなく完全一致(===)で判定
      if (currentKey === targetKey) {
        const extracted = cleanValue(rVal);
        if (extracted !== "") {
          return extracted;
        }
      }
    }
  }

  return "";
}

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

export function parseFlexibleDate(dateStr: string = ""): ParsedDate {
  const cleaned = toHalfWidth(dateStr);
  if (!cleaned) return { era: "", year: "", yearWithEra: "", month: "", day: "", padded6: "" };

  let era = "";
  let y = "", m = "", d = "";

  const kanjiMatch = cleaned.match(/^(?:(令和|平成|昭和|R|H|S)\s*)?(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/i);
  if (kanjiMatch) {
    era = kanjiMatch[1] || "";
    y = kanjiMatch[2];
    m = kanjiMatch[3];
    d = kanjiMatch[4];
  } else {
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

export function stripHospitalSuffix(name: string = ""): string {
  return name.replace(/(病院|診療所|薬局|クリニック)$/, "").trim();
}

export function padGridValue(val: string = "", length: number): string {
  const cleaned = toHalfWidth(val).replace(/[^\d]/g, "");
  return cleaned.padEnd(length, " ");
}

export function wrapText(text: string = "", maxChars: number): string {
  if (!text) return "";
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.substring(i, i + maxChars));
  }
  return lines.join("\n");
}
