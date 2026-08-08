import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import form5Json from './form5.json';

// --- 病院・薬局名の末尾（「病院」「薬局」など）を自動除去する関数 ---
function cleanHospitalName(name: string): string {
  if (!name) return '';
  return name.replace(/(病院|診療所|薬局|クリニック)$/g, '').trim();
}

// --- 各項目の描画ルール定義 ---
const FIELD_RULES: Record<string, { renderType: 'grid' | 'standard', pitch?: number, fontSize?: number }> = {
  // 1. 労働保険番号（サイズ14pt / ピッチ15.3）
  'Labor_insurance_No.': { renderType: 'grid', pitch: 15.3, fontSize: 14 },

  // 2. カタカナフリガナ（現状維持）
  'Name_in_Katakana': { renderType: 'grid', pitch: 13.8, fontSize: 11 },

  // 3. 生年月日・負傷年月日（サイズ14pt / ピッチ15.3）
  'date_of_birth': { renderType: 'grid', pitch: 15.3, fontSize: 14 },
  'Date_of_injury': { renderType: 'grid', pitch: 15.3, fontSize: 14 },

  // 4. 性別・元号（サイズ14pt）
  'sex': { renderType: 'standard', fontSize: 14 },
  'Date_of_birth,Japanese_era': { renderType: 'standard', fontSize: 14 },
  'Date_of_injury,Japanese_era': { renderType: 'standard', fontSize: 14 },

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
  // 薬局用のテンプレート切り替え処理
  const isPharmacy = formData.formType === 'pharmacy';
  const pdfFileName = isPharmacy ? 'form5_pharmacy.pdf' : 'form5.pdf';
  const pdfPath = path.join(__dirname, 'templates', pdfFileName);
  const fontPath = path.join(__dirname, 'fonts', 'NotoSansJP-Regular.ttf');

  const pdfBytes = fs.readFileSync(pdfPath);
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();

  // --- データの前処理・整頓 ---
  const data = { ...formData };

  // 1. 所属会社電話番号の下4桁抽出
  if (data["The_person's_affiliated_company_tel_num"]) {
    const rawTel = String(data["The_person's_affiliated_company_tel_num"]);
    if (rawTel.length > 4) {
      data["The_person's_affiliated_company_tel_num"] = rawTel.slice(-4);
    }
  }

  // 2. 経由病院名の整形（「病院」「薬局」等の自動カット）
  const hospitalRaw = data.Claim_Hospital_name || data.Hospital_name || '';
  data.Claim_Hospital_name = cleanHospitalName(hospitalRaw);

  // --- 描画ループ処理（JSONの pages 構造に対応） ---
  for (const pageConfig of form5Json.pages) {
    const pageIndex = pageConfig.page - 1;
    if (pageIndex >= pages.length) continue; // 該当ページが存在しない場合はスキップ

    const page = pages[pageIndex];

    for (const field of pageConfig.fields) {
      const value = data[field.id];
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
          page.drawText(char, {
            x: charX,
            y: field.y,
            size: fontSize,
            font: customFont,
            color: rgb(0, 0, 0)
          });
        }
      } else {
        // 通常印字処理
        page.drawText(strValue, {
          x: field.x,
          y: field.y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0)
        });
      }
    }
  }

  return await pdfDoc.save();
}
