import { buildForm5Data } from "../rules/mappers/form5Mapper";
import { parseRawText } from "../rules/utils/textUtils";
import { PdfService } from "../services/pdfService";

export interface GeneratedPDF {
  filename: string;
  buffer: Buffer;
}

/**
 * 様式第5号 生成処理（病院用・薬局用の一括生成）
 * @param inputText フロントエンドから届いた生テキストデータ
 */
export async function generateForm5PDFs(inputText: string): Promise<GeneratedPDF[]> {
  const results: GeneratedPDF[] = [];

  // 1. 生テキストをKeyValueオブジェクトに変換
  const rawInput = parseRawText(inputText);

  // 2. 病院用のデータ構築 & PDF生成
  const hospitalData = buildForm5Data(rawInput, "hospital");
  const hospitalBuffer = await PdfService.generatePdf("5", hospitalData);
  results.push({
    filename: "労災様式第5号_病院用.pdf",
    buffer: hospitalBuffer,
  });

  // 3. 薬局用データが存在するか判定（薬局名入力がある場合）
  const pharmacyName = rawInput["調剤を受けた薬局名"] || rawInput["薬局名"];
  if (pharmacyName && pharmacyName.trim() !== "") {
    const pharmacyData = buildForm5Data(rawInput, "pharmacy");
    const pharmacyBuffer = await PdfService.generatePdf("5", pharmacyData);
    results.push({
      filename: "労災様式第5号_薬局用.pdf",
      buffer: pharmacyBuffer,
    });
  }

  return results;
}

/**
 * 様式第6号 生成処理（様式第5号のテキストを引き継いで生成）
 * ※様式第5号完成後の拡張用テンプレート
 */
export async function generateForm6PDFs(
  form5InputText: string,
  form6InputText: string
): Promise<GeneratedPDF[]> {
  // 現状は空配列または様式6用の実装準備
  const results: GeneratedPDF[] = [];
  // 今後、form5InputText と form6InputText を結合解析して generatePdf("6", mappedData) を呼び出す構成にします
  return results;
}
