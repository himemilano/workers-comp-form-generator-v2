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

export class PdfService {
  /**
   * マッピング済みのデータとスキーマを元にPDFを生成する
   */
  public static async generatePdf(
    formType: "5" | "6",
    mappedData: Record<string, any>
  ): Promise<Buffer> {
    // 1. スキーマとテンプレートPDFの読み込み（dist/schemas, dist/templates 等を参照）
    const schemaPath = path.join(__dirname, `../schemas/form${formType}.json`);
    const schemaContent = await fs.readFile(schemaPath, "utf-8");
    const schema: FormSchema = JSON.parse(schemaContent);

    const templatePath = path.join(__dirname, `../templates/${schema.template}`);
    const templateBytes = await fs.readFile(templatePath);

    // 2. PDFドキュメントの読み込みとfontkitの登録
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

        const fontSize = field.fontSize || 10;

        // A. 丸印 (〇) 描画
        if (field.type === "circle" || field.id.startsWith("time_")) {
          if (val === true || val === "〇" || val === "有") {
            page.drawText("〇", {
              x: field.x,
              y: field.y,
              size: fontSize || 14,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }
          continue;
        }

        // B. マス目印字 (pitch 指定あり)
        if (field.pitch) {
          const cleanText = String(val).replace(/-/g, "");
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

        // C. 複数行折り返し指定項目 (災因・発生状況や傷病状態等)
        if (field.maxChars || field.lineHeight || typeof val === "string" && val.includes("\n")) {
          const maxChars = field.maxChars || 47;
          const lineHeight = field.lineHeight || 16;
          const lines = String(val).split("\n");
          let lineIdx = 0;

          for (const line of lines) {
            for (let i = 0; i < line.length; i += maxChars) {
              const subLine = line.substring(i, i + maxChars);
              page.drawText(subLine, {
                x: field.x,
                y: field.y - lineIdx * lineHeight,
                size: fontSize,
                font: customFont,
                color: rgb(0, 0, 0),
              });
              lineIdx++;
            }
          }
          continue;
        }

        // D. 通常テキスト描画
        page.drawText(String(val), {
          x: field.x,
          y: field.y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
      }
    }

    // 5. PDFの書き出し (Buffer型で返却)
    const outputUint8Array = await pdfDoc.save();
    return Buffer.from(outputUint8Array);
  }
}
