export function parseYYMMDD(dateStr: string) {
  if (!dateStr) return { era: "", year: "", month: "", day: "" };
  const digits = dateStr.replace(/\D/g, "");
  if (digits.length === 6) {
    return {
      era: "",
      year: digits.substring(0, 2),
      month: digits.substring(2, 4),
      day: digits.substring(4, 6),
    };
  }
  return { era: "", year: "", month: "", day: "" };
}

export function parseJapaneseDate(dateStr: string) {
  if (!dateStr) return { era: "", year: "", month: "", day: "" };
  return { era: "", year: "", month: "", day: "" };
}
