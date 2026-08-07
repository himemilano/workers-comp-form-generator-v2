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

/**
 * テキストの折り返し自動改行描画（病院名や長文用）
 */
function drawMultiLineText(
  page: any,
  text: string,
  x: number,
  startY: number,
  lineHeight: number,
  maxCharsPerLine: number,
  maxLines: number,
  font: PDFFont,
  fontSize: number
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
    page.drawText(line, {
      x: x,
      y: startY - idx * lineHeight,
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

  const isForm5 = schema.form === '5';

  for (const pageSchema of schema.pages) {
    const pageIndex = pageSchema.page - 1;
    if (pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);

    for (const field of pageSchema.fields) {
      let val = formData[field.id];

      // Form5 のデータフォールバック補完（白紙防止）
      if (val === undefined || val === null || val === '') {
        if (field.id === 'worker_name') val = formData['氏名(漢字)'] || formData['氏名'] || formData['労働者氏名'];
        else if (field.id === 'Hospital_name') val = formData['診療を受けた病院名'] || formData['病院名'];
        else if (field.id === 'Claim_Hospital_name') val = formData['診療を受けた病院名'] || formData['病院名'] || formData['薬局名'];
        else if (field.id === 'Labor_insurance_No.') val = formData['特別加入の労働保険番号'] || formData['労働保険番号'];
        else if (field.id === 'accident_detail') val = formData['災害の原因と発生状況'] || formData['災害の原因及び発生状況'];
      }

      if (val === undefined || val === null || val === '') continue;

      const strVal = String(val);
      const fontSize = field.fontSize || 9;

      // 1. 特殊ピッチマス目印字
      if (isForm5 && field.id === 'Labor_insurance_No.') {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 14);
      } else if (isForm5 && (field.id === 'date_of_birth' || field.id === 'Date_of_injury')) {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 6);
      } else if (isForm5 && field.id === 'Name_in_Katakana') {
        const kanaChars = normalizeKatakana(strVal);
        drawSpacedText(page, kanaChars.join(''), field.x, field.y, 13.5, customFont, fontSize, 16);
      } else if (isForm5 && (field.id === 'zip_first' || field.id === 'claimant_zip_first')) {
        drawSpacedText(page, strVal, field.x, field.y, 12.0, customFont, fontSize, 3);
      } else if (isForm5 && (field.id === 'zip_last' || field.id === 'claimant_zip_last')) {
        drawSpacedText(page, strVal, field.x, field.y, 12.0, customFont, fontSize, 4);
      } 
      
      // 2. 病院名・住所・長文の自動「折り返し処理」（改行描画）
      else if (
        field.id === 'Claim_Hospital_name' ||
        field.id === 'Hospital_name' ||
        field.id === 'Hospital_after_transfer'
      ) {
        // 病院名は横幅に応じて2行に折り返し（フォントサイズ8pt、行間10pt、半角/全角考慮で11文字折り返し）
        drawMultiLineText(page, strVal, field.x, field.y, 10, 11, 2, customFont, 8);
      } else if (field.id === 'accident_detail' || field.id === 'Reason_for_transfer_to_another_hospital') {
        drawMultiLineText(page, strVal, field.x, field.y, 13, 26, 4, customFont, 8);
      } else if (field.id === "Claimant's_address" || field.id === "Address_of_the_hospital_after_transfer" || field.id === "Hospital_Address") {
        drawMultiLineText(page, strVal, field.x, field.y, 10, 16, 2, customFont, 8);
      } else if (!isForm5 && field.id === 'worker_name') {
        drawMultiLineText(page, strVal, field.x, field.y, 10, 10, 2, customFont, 8);
      } 
      
      // 3. 通常文字描画
      else {
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

  // --- 転院1回目 ---
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

  // --- 転院2回目 ---
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