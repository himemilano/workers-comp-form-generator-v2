import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import form5Json from './form5.json';

// --- 各項目の描画ルール定義 ---
// fontSize: 11 （性別のフォントサイズに統一）
// Name_in_Katakana のみ現状維持のピッチとサイズを適用
const FIELD_RULES: Record<string, { renderType: 'grid' | 'standard', pitch?: number, fontSize?: number }> = {
  // 1. 労働保険番号（標準サイズ11pt / ピッチ15.3）
  'Labor_insurance_No.': { renderType: 'grid', pitch: 15.3, fontSize: 11 },

  // 2. カタカナフリガナ（現状維持）
  'Name_in_Katakana': { renderType: 'grid', pitch: 13.8, fontSize: 11 },

  // 3. 生年月日・負傷年月日（標準サイズ11pt / ピッチ15.3）
  'date_of_birth': { renderType: 'grid', pitch: 15.3, fontSize: 11 },
  'Date_of_injury': { renderType: 'grid', pitch: 15.3, fontSize: 11 },

  // 4. 性別・元号（標準サイズ11pt）
  'sex': { renderType: 'standard', fontSize: 11 },
  'Date_of_birth,Japanese_era': { renderType: 'standard', fontSize: 11 },
  'Date_of_injury,Japanese_era': { renderType: 'standard', fontSize: 11 },

  // 5. 郵便番号（標準サイズ11pt）
  'zip_first': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'zip_last': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'claimant_zip_first': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'claimant_zip_last': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'Company_zip_first': { renderType: 'standard', fontSize: 11 },
  'Company_zip_last': { renderType: 'standard', fontSize: 11 },
  'Hospital_zip_first': { renderType: 'standard', fontSize: 11 },
  'Hospital_zip_last': { renderType: 'standard', fontSize: 11 }
};

export async function generateForm5PDF(formData: Record<string, any>): Promise<Uint8Array> {
  const pdfPath = path.join(__dirname, 'templates', 'form5.pdf');
  const fontPath = path.join(__dirname, 'fonts', 'NotoSansJP-Regular.ttf');

  const pdfBytes = fs.readFileSync(pdfPath);
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  for (const field of form5Json) {
    const value = formData[field.id];
    if (value === undefined || value === null || value === '') {
      continue; // 未入力欄はスキップ
    }

    const strValue = String(value);
    const rule = FIELD_RULES[field.id];
    const fontSize = rule?.fontSize || field.fontSize || 10;

    if (rule?.renderType === 'grid' && rule.pitch) {
      // マス目（一定間隔ピッチ）印字処理
      for (let i = 0; i < strValue.length; i++) {
        const char = strValue[i];
        const charX = field.x + (i * rule.pitch);
        firstPage.drawText(char, {
          x: charX,
          y: field.y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0)
        });
      }
    } else {
      // 通常印字処理
      firstPage.drawText(strValue, {
        x: field.x,
        y: field.y,
        size: fontSize,
        font: customFont,
        color: rgb(0, 0, 0)
      });
    }
  }

  return await pdfDoc.save();
}
