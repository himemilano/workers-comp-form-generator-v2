export function splitPostalCode(zipStr: string) {
  if (!zipStr) return { first: "", last: "" };
  const clean = zipStr.replace(/[^\d]/g, "");
  return {
    first: clean.slice(0, 3),
    last: clean.slice(3, 7),
  };
}

