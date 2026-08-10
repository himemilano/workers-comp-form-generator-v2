
import { ClaimRecord, RawInputData } from "../types/form";

/**
 * 生入力データ（rawInput）の永続化・引き継ぎ用リポジトリ
 * ※運用環境に合わせてPostgreSQL/Prisma/MongoDB等に置き換え可能です。
 */
export class ClaimRepository {
  private static store: Map<string, ClaimRecord> = new Map();

  /**
   * 案件IDで保存済みのレコードを検索
   */
  async findById(claimId: string): Promise<ClaimRecord | null> {
    const record = ClaimRepository.store.get(claimId);
    return record ? { ...record } : null;
  }

  /**
   * 生入力データを保存し、既存データがあれば追加入力を上書きマージします
   */
  async saveOrUpdate(claimId: string, newRawInput: RawInputData): Promise<ClaimRecord> {
    const existing = await this.findById(claimId);
    const now = new Date();

    let updatedRawInput: RawInputData;
    if (existing) {
      updatedRawInput = {
        ...existing.rawInput,
        ...newRawInput
      };
    } else {
      updatedRawInput = { ...newRawInput };
    }

    const record: ClaimRecord = {
      claimId,
      rawInput: updatedRawInput,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    ClaimRepository.store.set(claimId, record);
    return record;
  }
}
