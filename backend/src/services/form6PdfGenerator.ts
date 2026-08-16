import { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { MappedFormData } from "../types/form";
import { wrapText } from "../rules/utils/textUtils";

interface FieldConfig {
  id: string;
  x: number;
  y: number;
  fontSize?: number;
  pitch?: number;
}

interface PageConfig {
  page: number;
  name: string;
  fields: FieldConfig[];
}

interface Form6JsonConfig {
  form: string;
  name: string;
  template: string;
  pages: PageConfig[];
}

interface FieldWrapSetting {
  maxChars: number;
  lineHeight: number;
}

// 項目ごとの折り返し・行間ピッチ設定
const FIELD_WRAP_CONFIGS: Record<string, FieldWrapSetting> = {
  accident_detail: { maxChars: 52, lineHeight: 7 },
  Reason_for_after_Hospital: { maxChars: 25, lineHeight: 7 },
  worker_name: { maxChars: 17, lineHeight: 9 },
  "Claimant's_address": { maxChars: 17, lineHeight: 9 },
  Location_and_condition_of_the_injury: { maxChars: 25, lineHeight: 8 },
  Company_Address: { maxChars: 28, lineHeight: 8 },
  notification_Address: { maxChars: 28, lineHeight: 8 }
};

export class Form6PdfGenerator {
  private jsonConfig: Form6JsonConfig;

  constructor() {
    const configPath = path.join(__dirname, "../config/form6.json");
    const rawData = fs.readFileSync(configPath, "utf-8");
    this.jsonConfig = JSON.parse(rawData);
  }

  public async generatePdf(formDataList: MappedFormData[]): Promise<Buffer> {
    const templatePath = path.join(__dirname, "../templates/form6.pdf");
    const templateBytes = fs.readFileSync(templatePath);
    
    const outputPdf = await PDFDocument.create();
    outputPdf.registerFontkit(fontkit);

    const fontPath = path.join(__dirname, "../fonts/NotoSansJP-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await outputPdf.embedFont(fontBytes);

    for (const formData of formDataList) {
      const templatePdf = await PDFDocument.load(templateBytes);
      templatePdf.registerFontkit(fontkit);

      const pages = templatePdf.getPages();
      const page1 = pages[0];

      const page1Config = this.jsonConfig.pages.find((p) => p.page === 1);
      if (page1Config) {
        this.renderFields(page1, page1Config.fields, formData, customFont);
      }

      if (pages.length > 1) {
        const page2 = pages[1];
        const page2Config = this.jsonConfig.pages.find((p) => p.page === 2);
        if (page2Config) {
          this.renderFields(page2, page2Config.fields, formData, customFont);
        }
      }

      const copiedPages = await outputPdf.copyPages(templatePdf, templatePdf.getPageIndices());
      copiedPages.forEach((p) => outputPdf.addPage(p));
    }

    const pdfBytes = await outputPdf.save();
    return Buffer.from(pdfBytes);
  }

  private renderFields(
    targetPage: any,
    fields: FieldConfig[],
    formData: MappedFormData,
    font: PDFFont
  ): void {
    for (const field of fields) {
      const key = field.id;
      const rawValue = formData[key];

      if (rawValue === undefined || rawValue === null || rawValue === "") {
        continue;
      }

      const strValue = String(rawValue);
      const fontSize = field.fontSize || 10;

      // ① 請求医療機関名: 改行なしの1行描画
      if (key === "Claim_Hospital_name") {
        const singleLineText = strValue.replace(/\r?\n/g, "");
        targetPage.drawText(singleLineText, {
          x: field.x,
          y: field.y,
          size: fontSize,
          font
        });
        continue;
      }

      // ② OCR指定枠 (Pitchプロパティが存在する場合)
      if (field.pitch && field.pitch > 0) {
        const chars = strValue.split("");
        chars.forEach((char: string, index: number) => {
          targetPage.drawText(char, {
            x: field.x + index * field.pitch!,
            y: field.y,
            size: fontSize,
            font
          });
        });
        continue;
      }

      // ③ 折り返し・行間ピッチ指定のある項目 (FIELD_WRAP_CONFIGS)
      const wrapConfig = FIELD_WRAP_CONFIGS[key];
      if (wrapConfig) {
        const wrappedResult = wrapText(strValue, wrapConfig.maxChars);
        const lines: string[] = typeof wrappedResult === "string"
          ? wrappedResult.split("\n")
          : Array.isArray(wrappedResult)
            ? wrappedResult
            : [String(wrappedResult)];

        lines.forEach((line: string, index: number) => {
          targetPage.drawText(line, {
            x: field.x,
            y: field.y - index * wrapConfig.lineHeight,
            size: fontSize,
            font
          });
        });
        continue;
      }

      // ④ その他の標準印字
      targetPage.drawText(strValue, {
        x: field.x,
        y: field.y,
        size: fontSize,
        font
      });
    }
  }
}
