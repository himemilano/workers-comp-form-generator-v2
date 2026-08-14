/**
 * キーバリューオブジェクトから値を取得する
 * （(例: ...) の除去、スペース除去、全半角補正を自動で行い完全補正）
 */
export function getVal(rawInput: Record<string, string>, key: string): string {
  // 1. 完全一致チェック
  if (rawInput[key] !== undefined) {
    return rawInput[key].trim();
  }

  // 2. キーの正規化関数（スペース除去、カッコ統一、(例:...) の注記を自動カット）
  const normalizeKey = (k: string) =>
    k
      .replace(/[\s\u3000]/g, "")           // 全角・半角スペースを全除去
      .replace(/（/g, "(")                   // カッコを半角に統一
      .replace(/）/g, ")")
      .replace(/\(例[:：][^)]*\)/gi, "");    // (例: ...) や (例：...) を丸ごとカット

  const targetNormalized = normalizeKey(key);

  for (const rKey of Object.keys(rawInput)) {
    if (normalizeKey(rKey) === targetNormalized) {
      return rawInput[rKey].trim();
    }
  }

  return "";
}
