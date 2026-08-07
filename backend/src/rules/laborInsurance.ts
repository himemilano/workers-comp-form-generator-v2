export function parseLaborInsurance(val: string) {
  if (!val) return "";
  return val.replace(/[^\d]/g, "");
}

