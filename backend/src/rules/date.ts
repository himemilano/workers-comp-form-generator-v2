export function parseYYMMDD(...args: any[]) {
  const dateStr = String(args[0] || "");
  const digits = dateStr.replace(/\D/g, "");
  if (digits.length === 6) {
    return {
      era: "",
      year: digits.substring(0, 2),
      month: digits.substring(2, 4),
      day: digits.substring(4, 6),
      full: digits,
    };
  }
  return { era: "", year: "", month: "", day: "", full: dateStr };
}

export function parseJapaneseDate(...args: any[]) {
  const dateStr = String(args[0] || "");
  const era = String(args[1] || "");
  const dayStr = String(args[2] || "");
  return {
    era: era || "",
    year: "",
    month: "",
    day: dayStr || "",
    full: dateStr,
  };
}
