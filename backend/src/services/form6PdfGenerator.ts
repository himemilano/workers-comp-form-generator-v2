import { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { Form6RawInput, mapForm6Data, Form6MappedData } from "../rules/mappers/form6Mapper";
import { renderForm5Page2 } from "./form5PdfGenerator"; // page2はform5の描画関数を流用

interface CoordinatesConfig {
  [key: string]: { x: number; y: number; fontSize?: number; maxWidth?: number; lineHeight?: number };
}

/**
 * 47文字単位でテキストを分割する（災害原因用）
 */
function chunkText(text: string, chunkSize: number = 47): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    lines.push(text.substring(i, i + chunkSize));
  }
  return lines;
}

/**
 * Form6 PDF一括生成（2回目以降のループ未出力問題を防止）
 */
export async function generateForm6Pdfs(
  dataList: Form6RawInput[],
  templatePdfBytes: Uint8Array,
  coordsConfig: CoordinatesConfig,
  font: PDFFont
): Promise<{ filename: string; pdfBytes: Uint8Array }[]> {
  const results: { filename: string; pdfBytes: Uint8Array }[] = [];

  // 配列をループ処理して複数回出力（1回目、2回目を確実に個別生成）
  for (let index = 0; index < dataList.length; index++) {
    const isSecondTime = index > 0;
    const iterationText = `${index + 1}回目`;
    const mappedData = mapForm6Data(dataList[index], isSecondTime);

    // テンプレートの読み込み
    const pdfDoc = await PDFDocument.load(templatePdfBytes);
    const pages = pdfDoc.getPages();
    const page1 = pages[0];

    // --- 表面 (Page 1) の描画 ---
    drawForm6Page1(page1, mappedData, coordsConfig, font);

    // --- 裏面 (Page 2) の描画（form5の処理をそのまま共通呼び出し） ---
    if (pages.length > 1) {
      await renderForm5Page2(pages[1], mappedData.page2RawData, coordsConfig, font);
    }

    const finalPdfBytes = await pdfDoc.save();
    results.push({
      filename: `様式第6号_${iterationText}.pdf`,
      pdfBytes: finalPdfBytes,
    });
  }

  return results;
}

/**
 * Page 1 描画詳細ロジック
 */
function drawForm6Page1(
  page: PDFPage,
  data: Form6MappedData,
  coords: CoordinatesConfig,
  font: PDFFont
) {
  const drawTextHelper = (key: string, text: string) => {
    if (!coords[key] || !text) return;
    const { x, y, fontSize = 10 } = coords[key];
    page.drawText(text, { x, y, size: fontSize, font });
  };

  // 1. 監督署名 & 指定病院番号
  drawTextHelper("inspection_office", data.inspectionOffice);
  drawTextHelper("designated_Hospital", data.designatedHospital);

  // 2. 負傷時刻
  drawTextHelper("injury_time_am", data.injuryTimeAm);
  drawTextHelper("injury_time_pm", data.injuryTimePm);
  drawTextHelper("disaster_hour", data.disasterHour);
  drawTextHelper("disaster_minute", data.disasterMinute);

  // 3. 住所（自動折り返し処理の修復）
  if (coords["worker_address"] && data.workerAddress) {
    const { x, y, fontSize = 9, maxWidth = 300, lineHeight = 11 } = coords["worker_address"];
    page.drawText(data.workerAddress, {
      x,
      y,
      size: fontSize,
      font,
      maxWidth,
      lineHeight,
    });
  }

  // 4. 災害の原因及び発生状況（47文字折返し & 行間調整）
  if (coords["disaster_cause"] && data.disasterCause) {
    const { x, y, fontSize = 8.5 } = coords["disaster_cause"];
    const lines = chunkText(data.disasterCause, 47);
    // 0.5文字分詰めたピッチ指定（フォントサイズ × 1.05～1.1 程度）
    const customLineHeight = fontSize * 1.1;

    lines.forEach((lineText, i) => {
      page.drawText(lineText, {
        x,
        y: y - i * customLineHeight,
        size: fontSize,
        font,
      });
    });
  }

  // 5. 日付データの描画（元号・年・月・日）
  const drawEraDate = (prefix: string, dateObj: { era: string; year: string; month: string; day: string }) => {
    drawTextHelper(`${prefix}_era`, dateObj.era);
    drawTextHelper(`${prefix}_year`, dateObj.year);
    drawTextHelper(`${prefix}_month`, dateObj.month);
    drawTextHelper(`${prefix}_day`, dateObj.day);
  };

  drawEraDate("submission", data.submissionDate);
  drawEraDate("disaster", data.disasterDate);
  drawEraDate("employer_cert", data.employerCertDate);
  drawEraDate("birth", data.birthDate);
}
