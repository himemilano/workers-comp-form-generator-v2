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

interface FieldWrapSetting {
  maxChars: number;  // 1行の最大文字数
  lineHeight: number; // 改行時のY軸移動ピッチ（ポイント）
}

/**
 * 長文項目ごとの個別折り返し・行間ピッチ設定マップ
 * ※ form6.json を変更せず、Form6専用で個別制御を行う定義です。
 *   実際の出力結果を見て数値（maxChars, lineHeight）を微調整してください。
 */
const FIELD_WRAP_CONFIGS: Record<string, FieldWrapSetting> = {
  // 1. 災害の原因と発生状況 (仕様: 1行最大52文字)
  accident_detail: { maxChars: 52, lineHeight: 11 },

  // 2. 転院理由 (1行最大25文字)
  Reason_for_after_Hospital: { maxChars: 25, lineHeight: 10 },

  // 3. 傷病の部位及び状態 (1行最大25文字)
  Location_and_condition_of_the_injury: { maxChars: 25, lineHeight: 10 },

  // 4. 本人住所 / 届出人住所 / 氏名 / 会社住所 (長文時の折り返し)
  "Claimant's_address": { maxChars: 25, lineHeight: 10 },
  notification_Address: { maxChars: 25, lineHeight: 10 },
  worker_name: { maxChars: 17, lineHeight: 10 },
  Company_Address: { maxChars: 28, lineHeight: 10 },
};

/**
 * テキストを改行コード（\n）および指定文字数で分割する
 */
function splitAndWrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const rawLines = text.split("\n");
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    if (rawLine.length === 0) {
      lines.push("");
    } else {
      for (let i = 0; i < rawLine.length; i += maxChars) {
        lines.push(rawLine.substring(i, i + maxChars));
      }
    }
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
  // 1. マッピング処理を実行
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

      const targetPage = coord.page && coord.page <= pages.length ? pages[coord.page - 1] : page1;
      const fontSize = coord.fontSize || 9;

      // ① 個別折り返し制御対象（4カ所＋長文項目）
      const wrapSetting = FIELD_WRAP_CONFIGS[key];
      if (wrapSetting) {
        const lines = splitAndWrapText(String(value), wrapSetting.maxChars);
        const lineHeight = wrapSetting.lineHeight;

        lines.forEach((lineText, i) => {
          targetPage.drawText(lineText, {
            x: coord.x,
            y: coord.y - i * lineHeight,
            size: fontSize,
            font,
          });
        });
        continue;
      }

      // ② 自動折り返し指定のある項目 (coord.maxWidth 指定時)
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
