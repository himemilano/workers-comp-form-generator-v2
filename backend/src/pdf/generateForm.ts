import { buildForm5Data } from "../rules/mappers/form5Mapper";
import { PdfService } from "../services/pdfService";

export interface GeneratedPDF {
  filename: string;
  buffer: Buffer;
}

/**
 * 生テキスト（"項目名 : 値"）をオブジェクト形式に変換する関数
 */
function parseRawText(rawText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = rawText.split("\n");
  let currentKey: string | null = null;

  for (const line of lines) {
    const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      currentKey = key;
      result[key] = val;
    } else if (
      currentKey &&
      line.trim() &&
      !line.startsWith("---") &&
      !line.startsWith("■") &&
      !line.startsWith("【") &&
      !line.startsWith("==")
    ) {
      // 複数行の入力（災害原因などの改行対応）
      result[currentKey] = result[currentKey]
        ? `${result[currentKey]}\n${line.trim()}`
        : line.trim();
    }
  }
  return result;
}

/**
 * 様式第5号 生成処理（病院用・薬局用の一括生成）
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
 */
export async function generateForm6PDFs(
  form5InputText: string,
  form6InputText: string
): Promise<GeneratedPDF[]> {
  const results: GeneratedPDF[] = [];
  return results;
}
