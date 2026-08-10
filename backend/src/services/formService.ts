import { MappedFormData, RawInputData } from "../types/form";
import { buildForm5Data } from "../rules/mappers/form5Mapper";
import { buildForm6Data } from "../rules/mappers/form6Mapper";
import { ClaimRepository } from "../repositories/claimRepository";

/**
 * 労災様式の生成およびForm 5からForm 6へのデータ引き継ぎを統括するサービス
 */
export class FormService {
  private claimRepository: ClaimRepository;

  constructor() {
    this.claimRepository = new ClaimRepository();
  }

  /**
   * 【Form 5 生成】生データを保存し、様式第5号用のデータ構造を生成
   */
  async generateForm5(claimId: string, inputData: RawInputData): Promise<MappedFormData> {
    const savedRecord = await this.claimRepository.saveOrUpdate(claimId, inputData);
    return buildForm5Data(savedRecord.rawInput);
  }

  /**
   * 【Form 6 生成】過去に保存された生データを読み出し、Form 6用の追加入力と統合して様式第6号用データを生成
   */
  async generateForm6(claimId: string, additionalInputData?: RawInputData): Promise<MappedFormData> {
    const existingRecord = await this.claimRepository.findById(claimId);
    if (!existingRecord) {
      throw new Error(`案件ID [${claimId}] の入力データが見つかりません。先にForm 5を作成してください。`);
    }

    let finalRawInput = existingRecord.rawInput;
    if (additionalInputData && Object.keys(additionalInputData).length > 0) {
      const updatedRecord = await this.claimRepository.saveOrUpdate(claimId, additionalInputData);
      finalRawInput = updatedRecord.rawInput;
    }

    return buildForm6Data(finalRawInput);
  }
}
