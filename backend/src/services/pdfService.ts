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

const AUTO_SCALE_FIELDS = [
  "Company_name_and_representative's_name",
  "Claimant's_address",
];

export class PdfService {
  /**
   * キー名の大文字小文字やアンダースコアの違いを柔軟に吸収して値を取得するヘルパー
   */
  private static getValue(mappedData: Record<string, any>, targetId: string): any {
    if (mappedData[targetId] !== undefined) return mappedData[targetId];

    // 完全一致で見つからない場合、文字のケースを無視して検索
    const normalizedTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const key of Object.keys(mappedData)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedKey === normalizedTarget) {
        return mappedData[key];
      }
    }
    return undefined;
  }

  public static async generatePdf(
    formType: "5" | "6",
    mappedData: Record<string, any>
  ): Promise<Buffer> {
    const schemaPath = path.join(__dirname, `../schemas/form${formType}.json`);
    const schemaContent = await fs.readFile(schemaPath, "utf-8");
    const schema: FormSchema = JSON.parse(schemaContent);

    const templatePath = path.resolve(__dirname, `../templates/${schema.template}`);
    const templateBytes = await fs.readFile(templatePath);

    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    pdfDoc.registerFontkit(fontkit);

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

    for (const pageConfig of schema.pages) {
      const pageIndex = (pageConfig.page || 1) - 1;
      const page = pages[pageIndex];
      if (!page) continue;

      for (const field of pageConfig.fields) {
        // キー名の揺れを吸収してデータ取得
        const val = this.getValue(mappedData, field.id);
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
        if (field.id === "accident_detail") {
          const maxChars = field.maxChars || 47;
          const lineHeight = field.lineHeight || 19.2;
          const fixedFontSize = 10.5;

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

        // D. 請求医療機関名 (Claim_Hospital_name) 専用描画
        if (field.id === "Claim_Hospital_name") {
          const rawLines = strVal.split("\n");
          const lineHeight = field.lineHeight || 11;

          rawLines.forEach((lineText, lineIdx) => {
            page.drawText(lineText, {
              x: field.x,
              y: field.y - lineIdx * lineHeight,
              size: fontSize,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          });
          continue;
        }

        // E. 長文で枠内に収まらない項目の動的縮小処理
        if (AUTO_SCALE_FIELDS.includes(field.id) && strVal.length > 28) {
          fontSize = Math.max(7, fontSize * (28 / strVal.length));
        }

        // F. 通常テキスト描画
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
