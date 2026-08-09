import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

// --- フォント設定 ---
const FONT_FILENAME = 'IPAexGothic.ttf';

// --- アセットファイル（templates/fonts/schemas）の多段自動探索関数 ---
function getAssetPath(subFolder: string, fileName: string): string {
  const candidatePaths = [
    // 1. 同階層・相対階層
    path.join(__dirname, subFolder, fileName),
    path.join(__dirname, '..', subFolder, fileName),
    path.join(__dirname, fileName),
    path.join(__dirname, '..', fileName),
    // 2. src ディレクトリ配下
    path.join(process.cwd(), 'src', 'pdf', subFolder, fileName),
    path.join(process.cwd(), 'src', 'pdf', fileName),
    path.join(process.cwd(), 'src', 'schemas', fileName),
    path.join(process.cwd(), 'src', subFolder, fileName),
    // 3. backend/src ディレクトリ配下
    path.join(process.cwd(), 'backend', 'src', 'pdf', subFolder, fileName),
    path.join(process.cwd(), 'backend', 'src', 'schemas', fileName),
    path.join(process.cwd(), 'backend', 'src', subFolder, fileName),
    // 4. カレントディレクトリ配下
    path.join(process.cwd(), subFolder, fileName),
    path.join(process.cwd(), fileName),
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

// --- JSON設定ファイルの安全な読み込み関数 ---
function loadJsonConfig(fileName: string): any {
  const subFolders = ['schemas', 'pdf', 'templates', ''];
  for (const sub of subFolders) {
    try {
      const jsonPath = getAssetPath(sub, fileName);
      if (fs.existsSync(jsonPath)) {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        const parsed = JSON.parse(content);
        console.log(`[JSON Loaded Successfully] ${fileName} from ${jsonPath}`);
        return parsed;
      }
    } catch (e) {
      // 探索を継続
    }
  }
  console.error(`[JSON Load Warning] ${fileName} が読み込めなかったため空設定を使用します`);
  return { pages: [] };
}

// 設定JSONの読み込み
const form5Json = loadJsonConfig('form5.json');
const form6Json = loadJsonConfig('form6.json');

// マッパーモジュールの動的読み込み
let mapForm5Data: any = null;
try {
  const m5 = require('../rules/mappers/form5Mapper');
  mapForm5Data = m5.mapForm5Data || m5.default || m5;
} catch (e) {
  try {
    const m5 = require('./form5Mapper');
    mapForm5Data = m5.mapForm5Data || m5.default || m5;
  } catch (e2) {
    mapForm5Data = null;
  }
}

let mapForm6Data: any = null;
try {
  const m6 = require('../rules/mappers/form6Mapper');
  mapForm6Data = m6.mapForm6Data || m6.default || m6;
} catch (e) {
  try {
    const m6 = require('./form6Mapper');
    mapForm6Data = m6.mapForm6Data || m6.default || m6;
  } catch (e2) {
    mapForm6Data = null;
  }
}

// --- 病院・薬局名の末尾整形関数 ---
function cleanHospitalName(name: string): string {
  if (!name) return '';
  return name.replace(/(病院|診療所|薬局|クリニック)$/g, '').trim();
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

// --- PDFページにデータを描画する汎用ヘルパー ---
async function renderPdfDocument(templateFileName: string, jsonConfig: any, data: any): Promise<Uint8Array> {
  const pdfPath = getAssetPath('templates', templateFileName);
  const fontPath = getAssetPath('fonts', FONT_FILENAME);

  const pdfBytes = fs.readFileSync(pdfPath);
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();

  // 所属会社電話番号の下4桁抽出
  if (data["The_person's_affiliated_company_tel_num"]) {
    const rawTel = String(data["The_person's_affiliated_company_tel_num"]);
    if (rawTel.length > 4) {
      data["The_person's_affiliated_company_tel_num"] = rawTel.slice(-4);
    }
  }

  // 病院名の整形
  const hospitalRaw = data.Claim_Hospital_name || data.Hospital_name || '';
  data.Claim_Hospital_name = cleanHospitalName(hospitalRaw);

  if (jsonConfig && Array.isArray(jsonConfig.pages)) {
    for (const pageConfig of jsonConfig.pages) {
      const pageIndex = pageConfig.page - 1;
      if (pageIndex >= pages.length) continue;

      const page = pages[pageIndex];

      for (const field of pageConfig.fields) {
        let value = data[field.id];
        if (value === undefined || value === null) {
          const foundKey = Object.keys(data).find(k => k.trim().toLowerCase() === field.id.trim().toLowerCase());
          if (foundKey) value = data[foundKey];
        }

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

  return await pdfDoc.save();
}

// --- 様式第5号 生成処理（病院用・薬局用の最大2枚を出力） ---
export async function generateForm5PDF(formData: any): Promise<Array<{ filename: string; buffer: Uint8Array }>> {
  let rawData: any = formData;
  if (typeof formData === 'string') {
    try {
      rawData = JSON.parse(formData);
    } catch (e) {
      rawData = { inputText: formData };
    }
  }

  let data = rawData;
  if (typeof mapForm5Data === 'function') {
    try {
      data = mapForm5Data(rawData);
    } catch (e) {
      console.warn('form5Mapper execution skipped:', e);
    }
  }

  const results: Array<{ filename: string; buffer: Uint8Array }> = [];

  // 1. 病院用の生成
  try {
    const hospitalBuffer = await renderPdfDocument('form5.pdf', form5Json, data);
    results.push({ filename: '様式5号(病院用).pdf', buffer: hospitalBuffer });
  } catch (e) {
    console.error('Hospital Form5 generation error:', e);
  }

  // 2. 薬局用の生成（テンプレートが存在する場合）
  try {
    const pharmacyTemplatePath = getAssetPath('templates', 'form5_pharmacy.pdf');
    if (fs.existsSync(pharmacyTemplatePath)) {
      const pharmacyBuffer = await renderPdfDocument('form5_pharmacy.pdf', form5Json, data);
      results.push({ filename: '様式5号(薬局用).pdf', buffer: pharmacyBuffer });
    }
  } catch (e) {
    // 薬局用テンプレートが無い場合はスキップ
  }

  return results;
}

// --- 様式第6号 生成処理（1回目・2回目の最大2枚を出力） ---
export async function generateForm6PDF(form5InputText: any, form6InputText: any): Promise<Array<{ filename: string; buffer: Uint8Array }>> {
  let parsed5 = typeof form5InputText === 'string' ? tryParseJson(form5InputText) : form5InputText;
  let parsed6 = typeof form6InputText === 'string' ? tryParseJson(form6InputText) : form6InputText;

  let mappedResult: any = null;
  if (typeof mapForm6Data === 'function') {
    try {
      mappedResult = mapForm6Data(parsed5, parsed6);
    } catch (e) {
      console.warn('form6Mapper execution skipped:', e);
    }
  }

  const results: Array<{ filename: string; buffer: Uint8Array }> = [];

  // 配列で渡された場合（1回目転院・2回目転院）
  if (Array.isArray(mappedResult)) {
    if (mappedResult.length > 0 && mappedResult[0]) {
      const buf1 = await renderPdfDocument('form6.pdf', form6Json, mappedResult[0]);
      results.push({ filename: '様式6号(1回目).pdf', buffer: buf1 });
    }
    if (mappedResult.length > 1 && mappedResult[1]) {
      const buf2 = await renderPdfDocument('form6.pdf', form6Json, mappedResult[1]);
      results.push({ filename: '様式6号(2回目).pdf', buffer: buf2 });
    }
  } else {
    // 単一オブジェクトの場合
    const data = mappedResult || { ...parsed5, ...parsed6 };
    
    // 1回目転院
    const buf1 = await renderPdfDocument('form6.pdf', form6Json, data);
    results.push({ filename: '様式6号(1回目).pdf', buffer: buf1 });

    // 2回目転院用データが存在する場合
    if (data.transfer2 || data.secondTransfer || data.hasSecondTransfer) {
      const transfer2Data = data.transfer2 || data.secondTransfer || data;
      const buf2 = await renderPdfDocument('form6.pdf', form6Json, transfer2Data);
      results.push({ filename: '様式6号(2回目).pdf', buffer: buf2 });
    }
  }

  return results;
}

function tryParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    return { inputText: text };
  }
}

// routes/pdf.ts 等のインポート用エイリアス
export { generateForm5PDF as generateForm5PDFs };
export { generateForm6PDF as generateForm6PDFs };
