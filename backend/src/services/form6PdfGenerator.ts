import { PDFDocument, PDFFont } from "pdf-lib";
import { RawInputData, MappedFormData } from "../types/form";
import { buildForm6Data } from "../rules/mappers/form6Mapper";

export interface CoordinatesConfig {
  [key: string]: {
    x: number;
    y: number;
    fontSize?: number;
    maxWidth?: number;
    lineHeight?: number;
    page?: number;
  };
}

/**
 * 47文字単位でテキストを分割する（災害原因用）
 */
function chunkText(text: string, chunkSize: number = 47): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    lines.push(text.substring(i, i + chunkSize));
  }
  return lines;
}

/**
 * Form6 PDF生成メイン処理
 * 1回目・2回目（転院先複数時）のPDFを確実にループ生成して配列で返却します。
 */
export async function generateForm6Pdfs(
  form5RawInput: RawInputData,
  form6RawInput: RawInputData,
  templatePdfBytes: Uint8Array,
  coordsConfig: CoordinatesConfig,
  font: PDFFont
): Promise<{ filename: string; pdfBytes: Uint8Array }[]> {
  // 1. マッピング処理を実行（1枚目、2枚目用の MappedFormData 配列を取得）
  const mappedDataList: MappedFormData[] = buildForm6Data(form5RawInput, form6RawInput);
  const results: { filename: string; pdfBytes: Uint8Array }[] = [];

  // 2. 1回目・2回目のデータをループ処理して個別にPDF生成
  for (let index = 0; index < mappedDataList.length; index++) {
    const data = mappedDataList[index];
    const iterationText = `${index + 1}回目`;

    const pdfDoc = await PDFDocument.load(templatePdfBytes);
    const pages = pdfDoc.getPages();
    const page1 = pages[0];

    // --- 各キーの描画処理 ---
    for (const [key, value] of Object.entries(data)) {
      if (!value) continue;

      const coord = coordsConfig[key];
      if (!coord) continue;

      // 対象ページ（指定がなければ1ページ目）
      const targetPage = coord.page && coord.page <= pages.length ? pages[coord.page - 1] : page1;
      const fontSize = coord.fontSize || 9;

      // ① 災害の原因及び発生状況（47文字折返し & 行間調整）
      if (key === "accident_detail") {
        const lines = chunkText(String(value), 47);
        // 行間ピッチをフォントサイズ×1.1（約0.5文字分詰めた配置）に指定
        const customLineHeight = fontSize * 1.1;

        lines.forEach((lineText, i) => {
          targetPage.drawText(lineText, {
            x: coord.x,
            y: coord.y - i * customLineHeight,
            size: fontSize,
            font,
          });
        });
        continue;
      }

      // ② 自動折り返し指定のある項目（住所など）
      if (coord.maxWidth) {
        targetPage.drawText(String(value), {
          x: coord.x,
          y: coord.y,
          size: fontSize,
          font,
          maxWidth: coord.maxWidth,
          lineHeight: coord.lineHeight || fontSize * 1.2,
        });
        continue;
      }

      // ③ 通常テキストの描画
      targetPage.drawText(String(value), {
        x: coord.x,
        y: coord.y,
        size: fontSize,
        font,
      });
    }

    const pdfBytes = await pdfDoc.save();
    results.push({
      filename: `様式第6号_${iterationText}.pdf`,
      pdfBytes,
    });
  }

  return results;
}
