import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

// --- フォント設定 ---
const FONT_FILENAME = 'IPAexGothic.ttf';

// JSONインポートの型エラー回避のため require を使用
let form5Json: any;
try {
  form5Json = require('./form5.json');
} catch (e) {
  try {
    form5Json = require('../schemas/form5.json');
  } catch (e2) {
    form5Json = { pages: [] };
  }
}

let form6Json: any;
try {
  form6Json = require('./form6.json');
} catch (e) {
  try {
    form6Json = require('../schemas/form6.json');
  } catch (e2) {
    form6Json = { pages: [] };
  }
}

// form6Mapper の動的読み込み
let mapForm6Data: any = null;
try {
  const mapperModule = require('../rules/mappers/form6Mapper');
  mapForm6Data = mapperModule.mapForm6Data || mapperModule.default || mapperModule;
} catch (e) {
  mapForm6Data = null;
}

// --- 病院・薬局名の末尾（「病院」「薬局」など）を自動除去する関数 ---
function cleanHospitalName(name: string): string {
  if (!name) return '';
  return name.replace(/(病院|診療所|薬局|クリニック)$/g, '').trim();
}

// --- アセットファイル（templates/fonts）の安全な多段自動探索関数 ---
function getAssetPath(subFolder: string, fileName: string): string {
  const candidatePaths = [
    // 1. generateForm.js と同階層 (例: dist/pdf/fonts, dist/pdf/templates)
    path.join(__dirname, subFolder, fileName),
    // 2. 1階層上 (例: dist/fonts, dist/templates)
    path.join(__dirname, '..', subFolder, fileName),
    // 3. ソースディレクトリ (src/pdf/fonts, src/pdf/templates)
    path.join(__dirname, '..', '..', 'src', 'pdf', subFolder, fileName),
    // 4. ソースディレクトリ (src/fonts, src/templates)
    path.join(__dirname, '..', '..', 'src', subFolder, fileName),
    // 5. プロジェクトルート / カレントディレクトリからの相対パス
    path.join(process.cwd(), 'src', 'pdf', subFolder, fileName),
    path.join(process.cwd(), 'src', subFolder, fileName),
    path.join(process.cwd(), 'backend', 'src', 'pdf', subFolder, fileName),
    path.join(process.cwd(), 'backend', 'src', subFolder, fileName),
    path.join(process.cwd(), 'backend', subFolder, fileName),
    path.join(process.cwd(), subFolder, fileName),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(
    `[アセット読み込みエラー] ファイルが見つかりません: ${subFolder}/${fileName}\n` +
    `探索したパス:\n` + candidatePaths.map(p => `  - ${p}`).join('\n')
  );
}

// --- 各項目の描画ルール定義 ---
const FIELD_RULES: Record<string, { renderType: 'grid' | 'standard', pitch?: number, fontSize?: number }> = {
  'Labor_insurance_No.': { renderType: 'grid', pitch: 15.3, fontSize: 14 },
  'Name_in_Katakana': { renderType: 'grid', pitch: 13.8, fontSize: 11 },
  'date_of_birth': { renderType: 'grid', pitch: 15.3, fontSize: 14 },
  'Date_of_injury': { renderType: 'grid', pitch: 15.3, fontSize: 14 },
  'sex': { renderType: 'standard', fontSize: 14 },
  'Date_of_birth,Japanese_era': { renderType: 'standard', fontSize: 14 },
  'Date_of_injury,Japanese_era': { renderType: 'standard', fontSize: 14 },
  'zip_first': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'zip_last': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'claimant_zip_first': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'claimant_zip_last': { renderType: 'grid', pitch: 12.0, fontSize: 11 },
  'Company_zip_first': { renderType: 'standard', fontSize: 11 },
  'Company_zip_last': { renderType: 'standard', fontSize: 11 },
  'Hospital_zip_first': { renderType: 'standard', fontSize: 11 },
  'Hospital_zip_last': { renderType: 'standard', fontSize: 11 }
};

// --- 様式第5号 生成処理 ---
export async function generateForm5PDF(formData: any): Promise<Array<{ filename: string; buffer: Uint8Array }>> {
  const data = typeof formData === 'string' ? { inputText: formData } : { ...formData };

  const isPharmacy = data.formType === 'pharmacy';
  const pdfFileName = isPharmacy ? 'form5_pharmacy.pdf' : 'form5.pdf';
  const pdfPath = getAssetPath('templates', pdfFileName);
  const fontPath = getAssetPath('fonts', FONT_FILENAME);

  const pdfBytes = fs.readFileSync(pdfPath);
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();

  if (data["The_person's_affiliated_company_tel_num"]) {
    const rawTel = String(data["The_person's_affiliated_company_tel_num"]);
    if (rawTel.length > 4) {
      data["The_person's_affiliated_company_tel_num"] = rawTel.slice(-4);
    }
  }

  const hospitalRaw = data.Claim_Hospital_name || data.Hospital_name || '';
  data.Claim_Hospital_name = cleanHospitalName(hospitalRaw);

  if (form5Json && Array.isArray(form5Json.pages)) {
    for (const pageConfig of form5Json.pages) {
      const pageIndex = pageConfig.page - 1;
      if (pageIndex >= pages.length) continue;

      const page = pages[pageIndex];

      for (const field of pageConfig.fields) {
        const value = data[field.id];
        if (value === undefined || value === null || value === '') continue;

        const strValue = String(value);
        const rule = FIELD_RULES[field.id];
        const fontSize = rule?.fontSize || field.fontSize || 10;

        if (rule?.renderType === 'grid' && rule.pitch) {
          for (let i = 0; i < strValue.length; i++) {
            page.drawText(strValue[i], {
              x: field.x + (i * rule.pitch),
              y: field.y,
              size: fontSize,
              font: customFont,
              color: rgb(0, 0, 0)
            });
          }
        } else {
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
  }

  const savedBytes = await pdfDoc.save();
  return [{ filename: pdfFileName, buffer: savedBytes }];
}

// --- 様式第6号 生成処理 ---
export async function generateForm6PDF(form5InputText: any, form6InputText: any): Promise<Array<{ filename: string; buffer: Uint8Array }>> {
  // マッパー関数が存在する場合はデータを成形、ない場合はオブジェクトとして結合
  let data: any = {};
  if (typeof mapForm6Data === 'function') {
    data = mapForm6Data(form5InputText, form6InputText);
  } else {
    const d5 = typeof form5InputText === 'string' ? { inputText5: form5InputText } : form5InputText;
    const d6 = typeof form6InputText === 'string' ? { inputText6: form6InputText } : form6InputText;
    data = { ...d5, ...d6 };
  }

  const pdfFileName = 'form6.pdf';
  const pdfPath = getAssetPath('templates', pdfFileName);
  const fontPath = getAssetPath('fonts', FONT_FILENAME);

  const pdfBytes = fs.readFileSync(pdfPath);
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();

  if (form6Json && Array.isArray(form6Json.pages)) {
    for (const pageConfig of form6Json.pages) {
      const pageIndex = pageConfig.page - 1;
      if (pageIndex >= pages.length) continue;

      const page = pages[pageIndex];

      for (const field of pageConfig.fields) {
        const value = data[field.id];
        if (value === undefined || value === null || value === '') continue;

        const strValue = String(value);
        const rule = FIELD_RULES[field.id];
        const fontSize = rule?.fontSize || field.fontSize || 10;

        if (rule?.renderType === 'grid' && rule.pitch) {
          for (let i = 0; i < strValue.length; i++) {
            page.drawText(strValue[i], {
              x: field.x + (i * rule.pitch),
              y: field.y,
              size: fontSize,
              font: customFont,
              color: rgb(0, 0, 0)
            });
          }
        } else {
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
  }

  const savedBytes = await pdfDoc.save();
  return [{ filename: pdfFileName, buffer: savedBytes }];
}

// routes/pdf.ts 等のインポート名（複数形）に合わせてエイリアスエクスポート
export { generateForm5PDF as generateForm5PDFs };
export { generateForm6PDF as generateForm6PDFs };
