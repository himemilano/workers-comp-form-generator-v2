export function truncateKana(str: string, maxLen?: number): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (maxLen && maxLen > 0) {
    return trimmed.slice(0, maxLen);
  }
  return trimmed;
}

export function normalizeKana(str: string): string {
  if (!str) return "";
  return str.trim();
}

export default truncateKana;