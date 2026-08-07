export function trimFacilitySuffix(...args: any[]) {
  const name = String(args[0] || "");
  return name.trim();
}
