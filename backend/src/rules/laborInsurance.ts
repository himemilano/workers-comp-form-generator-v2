export function parseLaborInsurance(...args: any[]) {
  const val = String(args[0] || "");
  const clean = val.replace(/[^\d]/g, "");
  const first2 = clean.slice(0, 2);
  const last11 = clean.slice(2, 13);
  return {
    full: clean,
    first2: first2,
    last11: last11,
  };
}

