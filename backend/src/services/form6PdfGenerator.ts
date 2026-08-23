import { PDFDocument, PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { MappedFormData } from "../types/form";

interface Point {
  x: number;
  y: number;
}

interface FieldConfig {
  pos: Point;
  fontSize?: number;
  maxChars?: number;
  lineHeight?: number;
}

// 表面 (Page 1) 座標マップ
const PAGE1_FIELD_POSITIONS: Record<string, FieldConfig> = {
  "Area_of_the_Labor_Standards_Inspection_Office": { pos: { x: 415, y: 780 }, fontSize: 10 },
  "Year_of_entry": { pos: { x: 382, y: 741 }, fontSize: 10 },
  "Month_of_entry": { pos: { x: 432, y: 741 }, fontSize: 10 },
  "Date_of_entry": { pos: { x: 472, y: 741 }, fontSize: 10 },
  "zip_first": { pos: { x: 380, y: 727 }, fontSize: 9 },
  "zip_last": { pos: { x: 415, y: 727 }, fontSize: 9 },
  "claimant_tel_area": { pos: { x: 480, y: 727 }, fontSize: 9 },
  "claimant_tel_city": { pos: { x: 512, y: 727 }, fontSize: 9 },
  "claimant_tel_num": { pos: { x: 540, y: 727 }, fontSize: 9 },
  "notification_Address": { pos: { x: 370, y: 708 }, fontSize: 8, maxChars: 20, lineHeight: 10 },
  "notification_Name": { pos: { x: 390, y: 678 }, fontSize: 10 },

  "Labor_insurance_No._first": { pos: { x: 125, y: 622 }, fontSize: 10 },
  "Labor_insurance_No._last": { pos: { x: 175, y: 622 }, fontSize: 10 },
  "worker_name": { pos: { x: 320, y: 622 }, fontSize: 10, maxChars: 15, lineHeight: 12 },
  "male": { pos: { x: 442, y: 630 }, fontSize: 10 },
  "female": { pos: { x: 442, y: 615 }, fontSize: 10 },
  
  "Year_of_birth": { pos: { x: 120, y: 575 }, fontSize: 10 },
  "Birth_month": { pos: { x: 175, y: 575 }, fontSize: 10 },
  "Birth_day": { pos: { x: 205, y: 575 }, fontSize: 10 },
  "age": { pos: { x: 238, y: 575 }, fontSize: 10 },
  "Claimant's_address": { pos: { x: 320, y: 585 }, fontSize: 8, maxChars: 15, lineHeight: 12 },
  "Job_type": { pos: { x: 505, y: 575 }, fontSize: 9 },

  "injury_year": { pos: { x: 120, y: 535 }, fontSize: 10 },
  "injury_month": { pos: { x: 175, y: 535 }, fontSize: 10 },
  "injury_day": { pos: { x: 205, y: 535 }, fontSize: 10 },
  "injury_time_am": { pos: { x: 235, y: 542 }, fontSize: 8 },
  "injury_time_pm": { pos: { x: 235, y: 528 }, fontSize: 8 },
  "disaster_hour": { pos: { x: 250, y: 535 }, fontSize: 10 },
  "disaster_minute": { pos: { x: 278, y: 535 }, fontSize: 10 },

  "accident_detail": { pos: { x: 125, y: 495 }, fontSize: 8, maxChars: 30, lineHeight: 11 },
  "Location_and_condition_of_the_injury": { pos: { x: 125, y: 118 }, fontSize: 8, maxChars: 25, lineHeight: 10 },

  "Year_of_proof_of_fact": { pos: { x: 120, y: 418 }, fontSize: 10 },
  "Month_of_Proof_of_Fact": { pos: { x: 175, y: 418 }, fontSize: 10 },
  "The_day_of_proof_of_fact": { pos: { x: 205, y: 418 }, fontSize: 10 },
  "Company_Name": { pos: { x: 210, y: 398 }, fontSize: 9 },
  "Company_zip_first": { pos: { x: 380, y: 418 }, fontSize: 9 },
  "Company_zip_last": { pos: { x: 415, y: 418 }, fontSize: 9 },
  "Company_tel_area": { pos: { x: 480, y: 418 }, fontSize: 9 },
  "Company_tel_city": { pos: { x: 512, y: 418 }, fontSize: 9 },
  "Company_tel_num": { pos: { x: 540, y: 418 }, fontSize: 9 },
  "Company_Address": { pos: { x: 370, y: 398 }, fontSize: 8, maxChars: 20, lineHeight: 10 },
  "Representative's_name": { pos: { x: 370, y: 375 }, fontSize: 9 },

  "designated_Hospital": { pos: { x: 255, y: 320 }, fontSize: 9 },
  "Claim_Hospital_name": { pos: { x: 390, y: 335 }, fontSize: 10 },

  "Hospital_name": { pos: { x: 210, y: 295 }, fontSize: 9 },
  "Hospital_Address": { pos: { x: 210, y: 275 }, fontSize: 8 },
  "Hospital_zip_first": { pos: { x: 505, y: 275 }, fontSize: 8 },
  "Hospital_zip_last": { pos: { x: 530, y: 275 }, fontSize: 8 },

  "after_Hospital": { pos: { x: 210, y: 245 }, fontSize: 9 },
  "after_Hospital_Address": { pos: { x: 210, y: 225 }, fontSize: 8 },
  "after_Hospital_zip_first": { pos: { x: 505, y: 225 }, fontSize: 8 },
  "after_Hospital_zip_last": { pos: { x: 530, y: 225 }, fontSize: 8 },

  // 最大幅35文字、行間を14に広げて枠内でゆったり配置（開始位置をy: 200に設定）
  "Reason_for_after_Hospital": { pos: { x: 210, y: 200 }, fontSize: 8, maxChars: 35, lineHeight: 14 }
};

// 裏面 (Page 2) 座標マップ（様式第6号の実際の枠位置に合わせた調整値）
const PAGE2_FIELD_POSITIONS: Record<string, FieldConfig> = {
  // ⑨ その他就業先の有無（様式6号では注意書きの下、y: 625 付近から開始）
  "Multiple": { pos: { x: 39, y: 625 }, fontSize: 10 },
  "Number_of_workplaces": { pos: { x: 147, y: 601 }, fontSize: 10 },
  "Name_of_Special_Member_Organization": { pos: { x: 383, y: 590 }, fontSize: 10 },
  "Special_Insurance_num": { pos: { x: 31, y: 555 }, fontSize: 10 },
  "Year_of_joining": { pos: { x: 358, y: 566 }, fontSize: 10 },
  "Joining_Month": { pos: { x: 451, y: 566 }, fontSize: 10 },
  "Joining_date": { pos: { x: 511, y: 566 }, fontSize: 10 }
};

export async function generateForm6Pdf(mappedDataList: MappedFormData[]): Promise<Buffer> {
  const templatePath = path.join(__dirname, "../../templates/form6_template.pdf");
  const fontPath = path.join(__dirname, "../../fonts/NotoSansJP-Regular.ttf");

  const templateBytes = fs.readFileSync(templatePath);
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages.length > 1 ? pages[1] : null;

  const data = mappedDataList[0] || {};

  // 1. 表面 (Page 1) 描画
  if (page1) {
    drawFieldsToPage(page1, data, PAGE1_FIELD_POSITIONS, customFont);
  }

  // 2. 裏面 (Page 2) 描画
  if (page2) {
    drawFieldsToPage(page2, data, PAGE2_FIELD_POSITIONS, customFont);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function splitTextByMaxChars(text: string, maxChars: number): string[] {
  if (!text) return [];
  const str = String(text);
  const result: string[] = [];

  for (let i = 0; i < str.length; i += maxChars) {
    result.push(str.slice(i, i + maxChars));
  }
  return result;
}

function drawFieldsToPage(
  page: any,
  data: MappedFormData,
  fieldMap: Record<string, FieldConfig>,
  font: PDFFont
) {
  for (const [key, config] of Object.entries(fieldMap)) {
    const rawVal = data[key];

    if (rawVal === undefined || rawVal === null || rawVal === "") continue;

    const fontSize = config.fontSize || 9;
    const lineHeight = config.lineHeight || fontSize + 2;
    const maxChars = config.maxChars;

    let lines: string[] = [];
    if (maxChars && maxChars > 0) {
      lines = splitTextByMaxChars(String(rawVal), maxChars);
    } else {
      lines = [String(rawVal)];
    }

    let currentY = config.pos.y;
    for (const line of lines) {
      page.drawText(line, {
        x: config.pos.x,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
      currentY -= lineHeight;
    }
  }
}
