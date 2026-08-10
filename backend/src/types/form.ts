/**
 * ユーザーや外部APIから受け取る生の入力データ型（Key-Value形式）
 */
export type RawInputData = Record<string, string>;

/**
 * PDF描画ライブラリ（pdf-lib/pdfme等）へ渡すマッピング後のJSON ID構造型
 */
export type MappedFormData = Record<string, string>;

/**
 * データベース・ストレージへ保持する労災申請案件の基本レコード型
 */
export interface ClaimRecord {
  claimId: string;
  rawInput: RawInputData;
  createdAt: Date;
  updatedAt: Date;
}
