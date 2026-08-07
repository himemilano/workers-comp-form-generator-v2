export function splitPostalCode(...args: any[]) {
  const zipStr = String(args[0] || "");
  const clean = zipStr.replace(/[^\d]/g, "");
  const first = clean.slice(0, 3);
  const last = clean.slice(3, 7);
  return {
    first: first,
    last: last,
    first3: first,
    last4: last,
    full: zipStr,
  };
}

