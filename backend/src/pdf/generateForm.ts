import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

// --- プロジェクト全体の万能ファイル探索関数 ---
function findFilePath(fileName: string, extraSubFolders: string[] = []): string | null {
  const subFolders = [
    '',
    'templates',
    'fonts',
    'schemas',
    'pdf',
    'src/pdf',
    'src/schemas',
    'public',
    'public/templates',
    'public/fonts',
    ...extraSubFolders
  ];
  const bases = [
    __dirname,
    path.join(__dirname, '..'),
    path.join(__dirname, '../..'),
    process.cwd(),
    path.join(process.cwd(), 'src'),
    path.join(process.cwd(), 'src/pdf'),
    path.join(process.cwd(), 'src/schemas'),
    path.join(process.cwd(), 'backend'),
    path.join(process.cwd(), 'backend/src'),
    path.join(process.cwd(), 'dist'),
  ];

  for (const base of bases) {
    for (const sub of subFolders) {
      const fullPath = path.join(base, sub, fileName);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return fullPath;
      }
    }
  }
  return null;
}

// フォントファイルの柔軟な探索
function findFontPath(): string | null {
  const fontNames = ['IPAexGothic.ttf', 'NotoSansJP-Regular.ttf', 'ipag.ttf', 'font.ttf'];
  for (const fontName of fontNames) {
    const fontPath = findFilePath(fontName, ['fonts', 'public/fonts']);
    if (fontPath) return fontPath;
  }
  return null;
}

// --- JSON設定の確実なロード ---
function loadJsonConfig(fileName: string): any {
  try {
    if (fileName === 'form5.json') return require('./form5.json');
    if (fileName === 'form6.json') return require('./form6.json');
  } catch (e) {}
  try {
    if (fileName === 'form5.json') return require('../schemas/form5.json');
    if (fileName === 'form6.json') return require('../schemas/form6.json');
  } catch (e) {}

  const jsonPath = findFilePath(fileName, ['schemas', 'pdf']);
  if (jsonPath) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(content);
      console.log(`[JSON Success] Loaded ${fileName} from ${jsonPath}`);
      return parsed;
    } catch (e) {
      console.error(`[JSON Parse Error] ${fileName}:`, e);
    }
  }
  console.error(`[JSON CRITICAL WARNING] ${fileName} が読み込めませんでした。`);
  return { pages: [] };
}

const form5Json = loadJsonConfig('form5.json');
const form6Json = loadJsonConfig('form6.json');

// --- マッパーモジュールの確実な読み込み ---
let mapForm5Data: any = null;
try {
  const m5 = require('../rules/mappers/form5Mapper');
  mapForm5Data = m5.buildForm5Data || m5.mapForm5Data || m5.default || m5;
} catch (e) {
  try {
    const m5 = require('./form5Mapper');
    mapForm5Data = m5.buildForm5Data || m5.mapForm5Data || m5.default || m5;
  } catch (e2) {}
}

let mapForm6Data: any = null;
try {
  const m6 = require('../rules/mappers/form6Mapper');
  mapForm6Data = m6.buildForm6Data || m6.mapForm6Data || m6.default || m6;
} catch (e) {
  try {
    const m6 = require('./form6Mapper');
    mapForm6Data = m6.buildForm6Data || m6.mapForm6Data || m6.default || m6;
  } catch (e2) {}
}

// --- 入力データのパース・正規化ヘルパー (改行区切りテキストもKeyValue連想配列に変換) ---
function normalizeInput(input: any): Record<string, string> {
  if (!input) return {};

  if (typeof input === 'object' && input !== null) {
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(input)) {
      const cleanKey = key.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (typeof val === 'string') {
        result[cleanKey] = val.trim();
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        result[cleanKey] = String(val);
      } else if (typeof val === 'object' && val !== null) {
        Object.assign(result, normalizeInput(val));
      }
    }
    return result;
  }

  if (typeof input === 'string') {
    const trimmed = input.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!trimmed) return {};

    // 1. JSON文字列の場合
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeInput(parsed);
      } catch (e) {}
    }

    // 2. 「キー: 値」の改行区切りテキストの場合
    const result: Record<string, string> = {};
    const lines = trimmed.split(/\r?\n/);
    for (const line of lines) {
      const colonIdx = line.search(/[:：]/);
      if (colonIdx !== -1) {
        const key = line.substring(0, colonIdx).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const val = line.substring(colonIdx + 1).trim();
        if (key) {
          result[key] = val;
        }
      }
    }

    if (Object.keys(result).length > 0) {
      return result;
    }

    return { inputText: trimmed };
  }

  return {};
}

// --- 深層データ値抽出ヘルパー ---
function extractValue(data: any, fieldId: string): any {
  if (!data || typeof data !== 'object') return undefined;

  // 1. 完全一致
  if (data[fieldId] !== undefined && data[fieldId] !== null && data[fieldId] !== '') {
    return data[fieldId];
  }

  // 2. 末尾ドット・大文字小文字・空白無視のキーマッチング
  const targetKey = fieldId.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
  for (const key of Object.keys(data)) {
    const cleanKey = key.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
    if (cleanKey === targetKey || cleanKey === targetKey.replace(/\.$/, '')) {
      const val = data[key];
      if (val !== undefined && val !== null && val !== '') return val;
    }
  }

  // 3. ネストされたオブジェクト内部の探索
  const subKeys = ['data', 'formData', 'values', 'fields', 'input', 'inputText', 'form5', 'form6'];
  for (const sub of subKeys) {
    if (data[sub] && typeof data[sub] === 'object') {
      const nestedVal = extractValue(data[sub], fieldId);
      if (nestedVal !== undefined) return nestedVal;
    }
  }

  return undefined;
}

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

// --- PDF描画の共通コアロジック ---
async function renderPdfDocument(templateFileName: string, jsonConfig: any, data: any): Promise<Uint8Array> {
  const pdfPath = findFilePath(templateFileName, ['templates']);
  const fontPath = findFontPath();

  if (!pdfPath) throw new Error(`[テンプレート不達] ${templateFileName} が見つかりません`);
  if (!fontPath) throw new Error(`[フォント不達] 日本語フォントファイルが見つかりません`);

  const pdfBytes = fs.readFileSync(pdfPath);
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();

  // 電話番号と病院名の前処理
  const telVal = extractValue(data, "The_person's_affiliated_company_tel_num");
  if (telVal) {
    const rawTel = String(telVal);
    if (rawTel.length > 4) {
      data["The_person's_affiliated_company_tel_num"] = rawTel.slice(-4);
    }
  }

  const hospitalRaw = extractValue(data, 'Claim_Hospital_name') || extractValue(data, 'Hospital_name') || '';
  if (hospitalRaw) {
    data.Claim_Hospital_name = cleanHospitalName(String(hospitalRaw));
  }

  if (jsonConfig && Array.isArray(jsonConfig.pages)) {
    for (const pageConfig of jsonConfig.pages) {
      const pageIndex = pageConfig.page - 1;
      if (pageIndex >= pages.length) continue;

      const page = pages[pageIndex];

      for (const field of pageConfig.fields) {
        const value = extractValue(data, field.id);
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

// --- 様式第5号 生成処理 ---
export async function generateForm5PDF(formData: any): Promise<Array<{ filename: string; buffer: Uint8Array }>> {
  const rawData = normalizeInput(formData);
  let mappedData: any = {};

  if (typeof mapForm5Data === 'function') {
    try {
      mappedData = mapForm5Data(rawData) || {};
    } catch (e) {
      console.warn('form5Mapper execution skipped:', e);
    }
  }

  const combinedData = { ...rawData, ...mappedData };
  const results: Array<{ filename: string; buffer: Uint8Array }> = [];

  // 1. 病院用の生成
  try {
    const hospitalBuffer = await renderPdfDocument('form5.pdf', form5Json, combinedData);
    results.push({ filename: '様式5号(病院用).pdf', buffer: hospitalBuffer });
  } catch (e) {
    console.error('Form5 Hospital generation error:', e);
  }

  // 2. 薬局用の生成
  try {
    const pharmacyTemplate = findFilePath('form5_pharmacy.pdf', ['templates']) ? 'form5_pharmacy.pdf' : 'form5.pdf';
    const pharmacyBuffer = await renderPdfDocument(pharmacyTemplate, form5Json, { ...combinedData, formType: 'pharmacy' });
    results.push({ filename: '様式5号(薬局用).pdf', buffer: pharmacyBuffer });
  } catch (e) {
    console.error('Form5 Pharmacy generation error:', e);
  }

  return results;
}

// --- 様式第6号 生成処理 ---
export async function generateForm6PDF(form5InputText: any, form6InputText: any): Promise<Array<{ filename: string; buffer: Uint8Array }>> {
  const parsed5 = normalizeInput(form5InputText);
  const parsed6 = normalizeInput(form6InputText);
  const mergedRaw = { ...parsed5, ...parsed6 };

  let mapped: any = null;
  if (typeof mapForm6Data === 'function') {
    try {
      mapped = mapForm6Data(mergedRaw);
      if (!mapped || Object.keys(mapped).length === 0) {
        mapped = mapForm6Data(parsed5, parsed6);
      }
    } catch (e) {
      try {
        mapped = mapForm6Data(parsed5, parsed6);
      } catch (e2) {
        console.warn('form6Mapper execution skipped:', e2);
      }
    }
  }

  let data1: any = null;
  let data2: any = null;

  if (Array.isArray(mapped)) {
    data1 = mapped[0];
    data2 = mapped[1];
  } else if (mapped && typeof mapped === 'object') {
    if (Array.isArray(mapped.transfers)) {
      data1 = mapped.transfers[0];
      data2 = mapped.transfers[1];
    } else {
      data1 = mapped;
    }
  }

  const combinedData1 = { ...mergedRaw, ...(data1 || {}) };

  const results: Array<{ filename: string; buffer: Uint8Array }> = [];

  // 1回目転院の生成
  try {
    const buf1 = await renderPdfDocument('form6.pdf', form6Json, combinedData1);
    results.push({ filename: '様式6号(1回目).pdf', buffer: buf1 });
  } catch (e) {
    console.error('Form6 (1st) generation error:', e);
  }

  // 2回目転院先情報のチェック
  const secondHospRaw =
    extractValue(parsed6, '2回目の転院先病院名') ||
    extractValue(parsed6, '2回目の病院名') ||
    extractValue(parsed6, '2回目の転院先') ||
    extractValue(parsed6, '2回目病院名') ||
    extractValue(parsed5, '2回目の転院先病院名') ||
    '';

  const secondHospMapped =
    extractValue(combinedData1, 'Hospitals_to_which_patients_can_be_transferred_after_receiving_their_pension.') ||
    extractValue(combinedData1, 'Address_of_the_hospital_to_which_the_patient_is_transferred_after_receiving_the_guaranteed_pension.') ||
    '';

  const hasSecondTransfer = Boolean(
    (data2 && typeof data2 === 'object' && Object.keys(data2).length > 0) ||
    (typeof secondHospRaw === 'string' && secondHospRaw.trim().length > 0) ||
    (typeof secondHospMapped === 'string' && secondHospMapped.trim().length > 0)
  );

  // 2回目転院の生成（データが存在する場合）
  if (hasSecondTransfer) {
    try {
      const combinedData2 = { ...combinedData1, ...(data2 && typeof data2 === 'object' ? data2 : {}) };
      const buf2 = await renderPdfDocument('form6.pdf', form6Json, combinedData2);
      results.push({ filename: '様式6号(2回目).pdf', buffer: buf2 });
      console.log('[Form6 Success] 様式6号(2回目).pdf を正常に生成しました');
    } catch (e) {
      console.error('Form6 (2nd) generation error:', e);
    }
  } else {
    console.log('[Form6 Info] 2回目の転院情報がないため、様式6号(2回目)の生成をスキップしました');
  }

  return results;
}

// routes インポート用エイリアス
export { generateForm5PDF as generateForm5PDFs };
export { generateForm6PDF as generateForm6PDFs };
