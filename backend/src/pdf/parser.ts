import path from "path";

/**
 * コロン区切りのテキストを key-value オブジェクトに変換する関数
 * 前後の空白（スペース）や全角コロン「：」にも対応
 */
export function parseKeyValueText(rawText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = rawText.split("\n");

  for (const line of lines) {
    // 全角・半角どちらのコロンでも分割可能にする
    const colonIndex = line.search(/[:：]/);
    if (colonIndex !== -1) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * 郵便番号「123-4567」を前半3桁と後半4桁に分割
 */
export function splitZipCode(zipStr?: string): { first: string; last: string } {
  if (!zipStr) return { first: "", last: "" };
  const cleaned = zipStr.replace(/[^\d-]/g, "");
  const parts = cleaned.split("-");
  if (parts.length === 2) {
    return { first: parts[0], last: parts[1] };
  }
  if (cleaned.length === 7) {
    return { first: cleaned.substring(0, 3), last: cleaned.substring(3) };
  }
  return { first: zipStr, last: "" };
}

/**
 * 電話番号「03-1234-5678」を3つの市外局番・局番・番号に分割
 */
export function splitTelNumber(telStr?: string): { area: string; city: string; num: string } {
  if (!telStr) return { area: "", city: "", num: "" };
  const parts = telStr.split("-");
  return {
    area: parts[0] || "",
    city: parts[1] || "",
    num: parts[2] || "",
  };
}