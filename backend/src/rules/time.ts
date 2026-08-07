export function parseInjuryTime(...args: any[]) {
  const timeStr = String(args[0] || "");
  const ampm = timeStr.toUpperCase();
  const isAM = ampm.includes("AM") || ampm.includes("午前");
  const isPM = ampm.includes("PM") || ampm.includes("午後");
  const digits = timeStr.replace(/\D/g, "");
  let hour = "";
  let minute = "";
  if (digits.length >= 2) {
    hour = digits.slice(0, 2);
    minute = digits.slice(2, 4);
  } else {
    hour = digits;
  }
  return {
    ampm: timeStr,
    hour: hour,
    minute: minute,
    amMark: isAM ? "○" : "",
    pmMark: isPM ? "○" : "",
  };
}
