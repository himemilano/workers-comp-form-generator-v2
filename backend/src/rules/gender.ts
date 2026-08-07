export interface GenderResult {
  code: string;
  maleMark: string;
  femaleMark: string;
}

export function parseGender(val: any): GenderResult {
  const str = String(val || "");
  if (str.includes("1") || str.includes("男")) {
    return { code: "1", maleMark: "○", femaleMark: "" };
  }
  if (str.includes("3") || str.includes("2") || str.includes("女")) {
    return { code: "3", maleMark: "", femaleMark: "○" };
  }
  return { code: "", maleMark: "", femaleMark: "" };
}

export default parseGender;

