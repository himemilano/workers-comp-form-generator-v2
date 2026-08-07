export function splitPhoneNumber(...args: any[]) {
  const phoneStr = String(args[0] || "");
  const clean = phoneStr.replace(/[^\d]/g, "");
  const parts = phoneStr.split("-");
  const area = parts[0] || clean.slice(0, 3);
  const city = parts[1] || clean.slice(3, 7);
  const number = parts[2] || clean.slice(7);
  const num = clean;
  return {
    area: area,
    city: city,
    number: number,
    num: num,
    full: phoneStr,
  };
}

