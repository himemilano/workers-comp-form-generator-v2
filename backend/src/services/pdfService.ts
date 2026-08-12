import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export interface FieldSchema {
  id: string;
  page?: number;
  x: number;
  y: number;
  fontSize?: number;
  pitch?: number;
  lineHeight?: number;
  maxChars?: number;
  type?: string;
}

export interface FormSchema {
  form: string;
  template: string;
  pages: Array<{
    page: number;
    name: string;
    fields: FieldSchema[];
  }>;
}

/**
 * 枠内に収めるために文字数超過時に動的にフォントを縮小するJSON IDリスト（最大30文字限界）
 */
const AUTO_SCALE_FIELDS = [
  "Company_name_and_representative's_name",
  "Claimant's_address",
];

export class PdfService {
  /**
   * マッピング済みのデータとスキーマを元にPDFを生成する
   */
  public static async generatePdf(
    formType: "5" | "6",
    mappedData: Record<string, any>
  ): Promise<Buffer> {
    // 1. スキーマ読み込み
    const schemaPath = path.join(__dirname, `../schemas/form${formType}.json`);
    const schemaContent = await fs.readFile(schemaPath, "utf-8");
    const schema: FormSchema = JSON.parse(schemaContent);

    // 2. テンプレートPDF読み込み
    const templatePath = path.resolve(__dirname, `../templates/${schema.template}`);
    const templateBytes = await fs.readFile(templatePath);

    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    pdfDoc.registerFontkit(fontkit);

    // 3. IPAexGothicフォントの読み込み
    const fontCandidates = [
      path.join(__dirname, "../fonts/IPAexGothic.ttf"),
      path.join(__dirname, "../../src/fonts/IPAexGothic.ttf"),
      path.resolve(process.cwd(), "src/fonts/IPAexGothic.ttf"),
      path.resolve(process.cwd(), "dist/fonts/IPAexGothic.ttf"),
    ];

    let fontBytes: Buffer | null = null;
    for (const p of fontCandidates) {
      try {
        fontBytes = await fs.readFile(p);
        break;
      } catch {
        continue;
      }
    }

    if (!fontBytes) {
      throw new Error("IPAexGothic.ttf フォントファイルが見つかりません。");
    }

    const customFont = await pdfDoc.embedFont(fontBytes);
    const pages = pdfDoc.getPages();

    // 4. スキーマに基づいて全フィールドを描画
    for (const pageConfig of schema.pages) {
      const pageIndex = (pageConfig.page || 1) - 1;
      const page = pages[pageIndex];
      if (!page) continue;

      for (const field of pageConfig.fields) {
        const val = mappedData[field.id];
        if (val === undefined || val === null || val === "" || val === false) {
          continue;
        }

        let fontSize = field.fontSize || 10;
        const strVal = String(val);

        // A. 丸印 (〇) 描画
        if (field.type === "circle" || field.id.startsWith("time_")) {
          if (val === true || val === "〇" || val === "有") {
            page.drawText("〇", {
              x: field.x,
              y: field.y,
              size: fontSize || 12,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }
          continue;
        }

        // B. マス目印字 (pitch 指定あり)
        if (field.pitch) {
          const cleanText = strVal.replace(/-/g, "");
          cleanText.split("").forEach((char, idx) => {
            page.drawText(char, {
              x: field.x + idx * field.pitch!,
              y: field.y,
              size: fontSize,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          });
          continue;
        }

        // C. 災害の原因と発生状況 (accident_detail) 専用描画
        // フォントサイズの縮小を行わず、48文字ごとに最大4行、14ptピッチで下へ移動
        if (field.id === "accident_detail") {
          const maxChars = field.maxChars || 48;
          const lineHeight = field.lineHeight || 14;
          const fixedFontSize = 10.5; // 固定フォントサイズ

          const rawLines = strVal.split("\n");
          const wrappedLines: string[] = [];

          for (const line of rawLines) {
            if (line.length === 0) {
              wrappedLines.push("");
            } else {
              for (let i = 0; i < line.length; i += maxChars) {
                wrappedLines.push(line.substring(i, i + maxChars));
              }
            }
          }

          // 最大4行分だけ下方向へ固定幅で落として描画
          const targetLines = wrappedLines.slice(0, 4);
          targetLines.forEach((lineText, lineIdx) => {
            page.drawText(lineText, {
              x: field.x,
              y: field.y - lineIdx * lineHeight,
              size: fixedFontSize,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          });
          continue;
        }

        // D. 長文で枠内に収まらない項目の動的縮小処理（最大30文字限界対応）
        if (AUTO_SCALE_FIELDS.includes(field.id) && strVal.length > 28) {
          fontSize = Math.max(7, fontSize * (28 / strVal.length));
        }

        // E. 通常テキスト描画
        page.drawText(strVal, {
          x: field.x,
          y: field.y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
      }
    }

    const outputUint8Array = await pdfDoc.save();
    return Buffer.from(outputUint8Array);
  }
}
