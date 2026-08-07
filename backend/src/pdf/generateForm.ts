import { PDFDocument, rgb, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

import { buildForm5Data } from '../rules/mappers/form5Mapper';
import * as form6Mapper from '../rules/mappers/form6Mapper';

export interface FieldSchema {
  id: string;
  page: number;
  x: number;
  y: number;
  fontSize?: number;
}

export interface FormSchema {
  form: string;
  name: string;
  template: string;
  pages: {
    page: number;
    name: string;
    fields: FieldSchema[];
  }[];
}

export interface PDFResult {
  filename: string;
  buffer: Buffer;
}

/**
 * 各印字項目（field.id）ごとの個別の印字ルール定義
 */
interface FieldRenderRule {
  fontSize?: number;
  renderType?: 'single' | 'multi' | 'grid';
  pitch?: number;               // マス目印字の文字ピッチ (px/pt)
  maxCharsPerLine?: number;     // 1行あたりの折り返し最大文字数
  lineHeight?: number;          // 改行時の行高
  extraLineSpacing?: number;    // 2行目以降の追加下方向オフセット (px/pt)
  maxLines?: number;            // 最大行数
  cleanFacilitySuffix?: boolean;// 末尾の「病院」「薬局」等を削除するか
  isCircleMark?: boolean;       // 「有」「無」の選択項目で「〇」を印字するか
}

const DEFAULT_FONT_SIZE = 10; // Job_typeと同等の標準フォントサイズ

const FIELD_RULES: Record<string, FieldRenderRule> = {
  // --- 1. 労働保険番号・特別加入番号（混同防止） ---
  'Labor_insurance_No.': { renderType: 'grid', pitch: 14.1, fontSize: 10 },
  'Special_Labor_insurance_No.': { renderType: 'single', fontSize: 10 },
  'special_insurance_no': { renderType: 'single', fontSize: 10 },

  // --- 2. マス目（Grid）印字項目 ---
  'Name_in_Katakana': { renderType: 'grid', pitch: 13.5, fontSize: 11 },
  'date_of_birth': { renderType: 'grid', pitch: 14.1, fontSize: 10 },
  'Date_of_injury': { renderType: 'grid', pitch: 14.1, fontSize: 10 },

  // 標準サイズの郵便番号マス目
  'zip_first': { renderType: 'grid', pitch: 12.0, fontSize: 10 },
  'zip_last': { renderType: 'grid', pitch: 12.0, fontSize: 10 },

  // Form5 本人郵便番号：マス目が一回り小さいため専用ピッチ（10.2pt）と小さめフォント（9pt）を適用
  'claimant_zip_first': { renderType: 'grid', pitch: 10.2, fontSize: 9 },
  'claimant_zip_last': { renderType: 'grid', pitch: 10.2, fontSize: 9 },

  // --- 3. 長文項目（47文字枠いっぱいに折り返し＋2行目以降を0.8文字分＝7.6pt下にずらす） ---
  'accident_detail': { renderType: 'multi', maxCharsPerLine: 47, lineHeight: 12, extraLineSpacing: 7.6, maxLines: 4, fontSize: 9.5 },
  'Reason_for_transfer_to_another_hospital': { renderType: 'multi', maxCharsPerLine: 47, lineHeight: 12, extraLineSpacing: 7.6, maxLines: 4, fontSize: 9.5 },

  // --- 4. 施設名（病院名・薬局名） ---
  // 「病院」のカット処理を解除し、枠に収まるよう12文字で折り返し
  'Claim_Hospital_name': { renderType: 'multi', maxCharsPerLine: 12, lineHeight: 11, maxLines: 2, fontSize: 9.5, cleanFacilitySuffix: false },
  'Hospital_name': { renderType: 'multi', maxCharsPerLine: 14, lineHeight: 11, maxLines: 2, fontSize: 9.5, cleanFacilitySuffix: false },
  'Hospital_after_transfer': { renderType: 'multi', maxCharsPerLine: 14, lineHeight: 11, maxLines: 2, fontSize: 9.5, cleanFacilitySuffix: false },

  // --- 5. 住所項目 ---
  "Claimant's_address": { renderType: 'multi', maxCharsPerLine: 26, lineHeight: 11, maxLines: 2, fontSize: 10 },
  "Hospital_Address": { renderType: 'multi', maxCharsPerLine: 26, lineHeight: 11, maxLines: 2, fontSize: 10 },
  "Address_of_the_hospital_after_transfer": { renderType: 'multi', maxCharsPerLine: 26, lineHeight: 11, maxLines: 2, fontSize: 10 },
  "worker_address": { renderType: 'multi', maxCharsPerLine: 26, lineHeight: 11, maxLines: 2, fontSize: 10 },

  // --- 6. 電話番号項目（崩れを防ぐため単一行自由印字） ---
  'phone_number': { renderType: 'single', fontSize: 10 },
  'company_phone': { renderType: 'single', fontSize: 10 },
  'tel_number': { renderType: 'single', fontSize: 10 },
  'business_phone': { renderType: 'single', fontSize: 10 },
  'claimant_phone': { renderType: 'single', fontSize: 10 },
  'Claimant_phone': { renderType: 'single', fontSize: 10 },

  // --- 7. 有無・フラグ項目（「有」を「〇」に変換して印字） ---
  'existence_flag': { renderType: 'single', fontSize: 12, isCircleMark: true },
  'has_third_party': { renderType: 'single', fontSize: 12, isCircleMark: true },
  'page2_yes_no': { renderType: 'single', fontSize: 12, isCircleMark: true },

  // --- 8. 単一行基本項目 ---
  'worker_name': { renderType: 'single', fontSize: 10 },
  'claimant_name': { renderType: 'single', fontSize: 10 },
  'Claimant_Name': { renderType: 'single', fontSize: 10 },
  'Job_type': { renderType: 'single', fontSize: 10 },
};

function loadAssetFile(relativePath: string): Buffer {
  const possiblePaths = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), 'backend', relativePath),
    path.resolve(__dirname, relativePath),
    path.resolve(__dirname, '..', relativePath),
    path.resolve(__dirname, '../..', relativePath),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const buffer = fs.readFileSync(p);
      if (buffer.length > 0) return buffer;
    }
  }

  throw new Error(`ファイル "${relativePath}" が見つかりませんでした。`);
}

function loadTemplatePdf(fileName: string): Buffer {
  return loadAssetFile(`templates/${fileName}`);
}

function loadFontFile(): Buffer {
  const fontPaths = [
    'backend/src/fonts/IPAexGothic.ttf',
    'src/fonts/IPAexGothic.ttf',
    'fonts/IPAexGothic.ttf',
  ];

  for (const fp of fontPaths) {
    try {
      return loadAssetFile(fp);
    } catch (e) {}
  }
  throw new Error('フォントファイル (IPAexGothic.ttf) が見つかりません。');
}

function loadSchemaFile(formNum: string): FormSchema {
  const schemaPaths = [
    `schemas/form${formNum}.json`,
    `schemas/form${formNum}_schema.json`,
    `backend/schemas/form${formNum}.json`,
  ];

  for (const sp of schemaPaths) {
    try {
      const buf = loadAssetFile(sp);
      return JSON.parse(buf.toString('utf-8'));
    } catch (e) {}
  }
  throw new Error(`様式第${formNum}号のスキーマJSONが見つかりません。`);
}

/**
 * 病院・薬局名から「病院」「診療所」「薬局」等の被り文字を除去（設定時のみ）
 */
function cleanFacilityName(name: string): string {
  if (!name) return "";
  return name.replace(/(病院|診療所|薬局|訪問看護事業者|訪問看護ステーション)$/g, "").trim();
}

function parseInputText(inputText: any): Record<string, string> {
  let parsed: Record<string, string> = {};

  if (typeof inputText === 'object' && inputText !== null) {
    parsed = { ...inputText };
  } else if (typeof inputText === 'string') {
    const trimmed = inputText.trim();
    try {
      const cleaned = trimmed.replace(/```json\s?|\s?```/g, '').trim();
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        parsed = JSON.parse(cleaned);
      }
    } catch (e) {}

    if (Object.keys(parsed).length === 0) {
      const lines = trimmed.split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^([^：:]+)[：:](.*)$/);
        if (match) {
          const key = match[1].replace(/^【|】$/g, '').trim();
          const value = match[2].trim();
          if (key) parsed[key] = value;
        }
      }
    }
  }

  return parsed;
}

function normalizeKatakana(str: string): string[] {
  const normalized = str.normalize('NFD');
  const result: string[] = [];
  for (const char of normalized) {
    if (char === '\u3099') result.push('゛');
    else if (char === '\u309A') result.push('ﾟ');
    else result.push(char);
  }
  return result;
}

function drawSpacedText(
  page: any,
  text: string,
  startX: number,
  y: number,
  pitch: number,
  font: PDFFont,
  fontSize: number,
  maxLen?: number
) {
  if (!text) return;
  const chars = Array.from(text).slice(0, maxLen);
  chars.forEach((char, index) => {
    page.drawText(char, {
      x: startX + index * pitch,
      y: y,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
  });
}

function drawMultiLineText(
  page: any,
  text: string,
  x: number,
  startY: number,
  lineHeight: number,
  maxCharsPerLine: number,
  maxLines: number,
  font: PDFFont,
  fontSize: number,
  extraLineSpacing: number = 0
) {
  if (!text) return;
  const lines: string[] = [];
  let currentLine = '';

  for (const char of text) {
    if (char === '\n') {
      lines.push(currentLine);
      currentLine = '';
      continue;
    }
    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = '';
    }
    currentLine += char;
  }
  if (currentLine) lines.push(currentLine);

  const targetLines = lines.slice(0, maxLines);
  targetLines.forEach((line, idx) => {
    // idx > 0 (2行目以降) の場合に extraLineSpacing 分だけ追加で下方向（Yを引く）にずらす
    const lineY = startY - idx * lineHeight - (idx * extraLineSpacing);
    page.drawText(line, {
      x: x,
      y: lineY,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
  });
}

export async function renderPdfForm(
  pdfBytes: Uint8Array,
  schema: FormSchema,
  formData: Record<string, any>,
  fontBytes: Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  for (const pageSchema of schema.pages) {
    const pageIndex = pageSchema.page - 1;
    if (pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);

    for (const field of pageSchema.fields) {
      let val = formData[field.id];

      // Form5 データ補完（※ 労働者氏名と請求人氏名の重複二重印字を防止）
      if (val === undefined || val === null || val === '') {
        if (field.id === 'worker_name') val = formData['労働者氏名'] || formData['氏名(漢字)'];
        else if (field.id === 'claimant_name' || field.id === 'Claimant_Name') val = formData['請求人氏名'] || formData['請求者氏名'];
        else if (field.id === 'Hospital_name') val = formData['診療を受けた病院名'] || formData['病院名'];
        else if (field.id === 'Claim_Hospital_name') val = formData['診療を受けた病院名'] || formData['病院名'] || formData['薬局名'];
        else if (field.id === 'Labor_insurance_No.') val = formData['労働保険番号'];
        else if (field.id === 'Special_Labor_insurance_No.' || field.id === 'special_insurance_no') val = formData['特別加入の労働保険番号'];
        else if (field.id === 'accident_detail') val = formData['災害の原因と発生状況'] || formData['災害の原因及び発生状況'];
      }

      if (val === undefined || val === null || val === '') continue;

      let strVal = String(val);

      // 個別ルール（FIELD_RULES）の取得
      const rule = FIELD_RULES[field.id] || {};
      const fontSize = rule.fontSize || field.fontSize || DEFAULT_FONT_SIZE;
      const renderType = rule.renderType || 'single';

      // 「有」などのテキストを「〇」記号に変換
      if (strVal === '有' || strVal === 'あり' || rule.isCircleMark) {
        if (strVal === '有' || strVal === 'あり' || strVal === '1' || strVal === 'true') {
          strVal = '〇';
        }
      }

      // 施設名の末尾トリム（設定時のみ）
      if (rule.cleanFacilitySuffix) {
        strVal = cleanFacilityName(strVal);
      }

      // --- 印字タイプ別振り分け ---
      if (renderType === 'grid') {
        const pitch = rule.pitch || 14.1;
        if (field.id === 'Name_in_Katakana') {
          const kanaChars = normalizeKatakana(strVal);
          drawSpacedText(page, kanaChars.join(''), field.x, field.y, pitch, customFont, fontSize, 16);
        } else {
          drawSpacedText(page, strVal, field.x, field.y, pitch, customFont, fontSize);
        }
      } else if (renderType === 'multi') {
        const maxCharsPerLine = rule.maxCharsPerLine || 20;
        const lineHeight = rule.lineHeight || 12;
        const extraLineSpacing = rule.extraLineSpacing || 0;
        const maxLines = rule.maxLines || 2;
        drawMultiLineText(page, strVal, field.x, field.y, lineHeight, maxCharsPerLine, maxLines, customFont, fontSize, extraLineSpacing);
      } else {
        // 単一行印字
        page.drawText(strVal, {
          x: field.x,
          y: field.y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * 様式第5号 生成API
 */
export async function generateForm5PDFs(inputText: any): Promise<PDFResult[]> {
  const parsedInput = parseInputText(inputText);
  const mappedData = buildForm5Data(parsedInput, false);
  const combinedData = { ...parsedInput, ...mappedData };

  const templatePdfBytes = loadTemplatePdf('form5.pdf');
  const fontBytes = loadFontFile();
  const schema = loadSchemaFile('5');

  const targets = [
    { filename: '様式5号（病院用）.pdf', type: 'hospital' },
    { filename: '様式5号（薬局用）.pdf', type: 'pharmacy' },
  ];

  const results: PDFResult[] = [];

  for (const target of targets) {
    const currentData = { ...combinedData };

    if (target.type === 'pharmacy') {
      const pharmacyName = parsedInput['薬局名'] || parsedInput['指定薬局名称'] || '';
      if (pharmacyName) {
        currentData['Claim_Hospital_name'] = pharmacyName;
      }
    }

    const pdfBytes = await renderPdfForm(templatePdfBytes, schema, currentData, fontBytes);
    results.push({
      filename: target.filename,
      buffer: Buffer.from(pdfBytes),
    });
  }

  return results;
}

/**
 * 様式第6号 生成API
 */
export async function generateForm6PDFs(f5InputText: any, f6InputText: any): Promise<PDFResult[]> {
  const parsedF5 = parseInputText(f5InputText);
  const parsedF6 = parseInputText(f6InputText);

  const f5Mapped = buildForm5Data(parsedF5, false);
  const mapF6Fn = (form6Mapper as any).buildForm6Data || ((x: any) => x);
  const f6Result = mapF6Fn(parsedF6, false);

  const baseData = f6Result.baseData || {};
  const transfer1 = f6Result.transfer1 || {};
  const transfer2 = f6Result.transfer2 || {};

  const templatePdfBytes = loadTemplatePdf('form6.pdf');
  const fontBytes = loadFontFile();
  const schema = loadSchemaFile('6');

  const results: PDFResult[] = [];

  if (transfer1.name) {
    const data1 = {
      ...parsedF5,
      ...f5Mapped,
      ...parsedF6,
      ...baseData,
      "Hospital_name": f5Mapped["Hospital_name"] || parsedF5['診療を受けた病院名'] || "",
      "Hospital_Address": f5Mapped["Hospital_Address"] || parsedF5['診療を受けた病院住所'] || "",
      "Hospital_after_transfer": transfer1.name,
      "Address_of_the_hospital_after_transfer": transfer1.address,
      "Postal_code_first_of_the_hospital_after_transfer": transfer1.zip?.first || "",
      "Postal_code_last_of_the_hospital_after_transfer": transfer1.zip?.last || "",
      "Reason_for_transfer_to_another_hospital": transfer1.reason,
    };

    const pdfBytes1 = await renderPdfForm(templatePdfBytes, schema, data1, fontBytes);
    results.push({
      filename: '様式6号（1回目）.pdf',
      buffer: Buffer.from(pdfBytes1),
    });
  }

  if (transfer2.name) {
    const data2 = {
      ...parsedF5,
      ...f5Mapped,
      ...parsedF6,
      ...baseData,
      "Hospital_name": transfer1.name,
      "Hospital_Address": transfer1.address,
      "Hospital_after_transfer": transfer2.name,
      "Address_of_the_hospital_after_transfer": transfer2.address,
      "Postal_code_first_of_the_hospital_after_transfer": transfer2.zip?.first || "",
      "Postal_code_last_of_the_hospital_after_transfer": transfer2.zip?.last || "",
      "Reason_for_transfer_to_another_hospital": transfer2.reason,
    };

    const pdfBytes2 = await renderPdfForm(templatePdfBytes, schema, data2, fontBytes);
    results.push({
      filename: '様式6号（2回目）.pdf',
      buffer: Buffer.from(pdfBytes2),
    });
  }

  return results;
}