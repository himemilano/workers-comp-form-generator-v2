import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

interface FieldSchema {
  id: string;
  page?: number;
  x: number;
  y: number;
  fontSize?: number;
}

interface FormSchema {
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
   * @param formType '5' | '6'
   * @param mappedData Mapperで生成した Key-Value オブジェクト
   * @returns 生成されたPDFの Buffer
   */
  public static async generatePdf(
    formType: "5" | "6",
    mappedData: Record<string, string>
  ): Promise<Uint8Array> {
    // 1. スキーマとテンプレートPDFの読み込み
    const schemaPath = path.join(process.cwd(), `schemas/form${formType}.json`);
    const schemaContent = await fs.readFile(schemaPath, "utf-8");
    const schema: FormSchema = JSON.parse(schemaContent);

    const templatePath = path.join(process.cwd(), `templates/${schema.template}`);
    const templateBytes = await fs.readFile(templatePath);

    // 2. PDFドキュメントの読み込みとfontkitの登録
    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);

    // 3. IPAexGothicフォントの読み込み
    // ※ backend/src/fonts/IPAexGothic.ttf を参照
    const fontPath = path.join(process.cwd(), "backend/src/fonts/IPAexGothic.ttf");
    const fontBytes = await fs.readFile(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();

    // 4. スキーマに基づいて全フィールドを描画
    for (const pageConfig of schema.pages) {
      const pageIndex = pageConfig.page - 1; // 1-indexed -> 0-indexed
      const page = pages[pageIndex];

      if (!page) continue;

      for (const field of pageConfig.fields) {
        const textToDraw = mappedData[field.id];

        // 値が存在しない、または空文字の場合はスキップ
        if (!textToDraw) continue;

        const fontSize = field.fontSize || 10;

        // PDFにテキストを描画
        page.drawText(textToDraw, {
          x: field.x,
          y: field.y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0), // 黒色
        });
      }
    }

    // 5. PDFの書き出し
    return await pdfDoc.save();
  }
}