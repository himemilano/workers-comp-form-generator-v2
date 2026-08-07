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

  const findValue = (...keys: string[]) => {
    for (const k of keys) {
      if (parsed[k]) return parsed[k];
    }
    return '';
  };

  const normalized: Record<string, string> = { ...parsed };

  normalized['本人郵便番号(例: 123-4567)'] = findValue('本人郵便番号(例: 123-4567)', '本人郵便番号', '郵便番号', 'zip');
  normalized['診療を受けた病院郵便番号(例: 100-0001)'] = findValue('診療を受けた病院郵便番号(例: 100-0001)', '病院郵便番号', '診療を受けた病院郵便番号');
  normalized['本人電話番号(例: 090-1234-5678)'] = findValue('本人電話番号(例: 090-1234-5678)', '本人電話番号', '電話番号', 'tel');
  normalized['病院電話番号(例: 03-1234-5678)'] = findValue('病院電話番号(例: 03-1234-5678)', '病院電話番号');
  normalized['生年月日(例: 55年5月15日→550515)'] = findValue('生年月日(例: 55年5月15日→550515)', '生年月日', 'date_of_birth');
  normalized['負傷年月日(例: 令和8年8月29日→080829)'] = findValue('負傷年月日(例: 令和8年8月29日→080829)', '負傷年月日', 'Date_of_injury');
  normalized['記入日(例: 令和8年8月30日)'] = findValue('記入日(例: 令和8年8月30日)', '記入日', '日付');
  normalized['負傷時刻区分(AM または PM)'] = findValue('負傷時刻区分(AM または PM)', '負傷時刻区分', 'AM/PM');
  normalized['負傷時刻(時)'] = findValue('負傷時刻(時)', '負傷時刻時', '時');
  normalized['負傷時刻(分)'] = findValue('負傷時刻(分)', '負傷時刻分', '分');
  normalized['特別加入の労働保険番号'] = findValue('特別加入の労働保険番号', '労働保険番号', 'Labor_insurance_No.');
  normalized['診療を受けた病院名'] = findValue('診療を受けた病院名', '病院名', 'Hospital_name');
  normalized['住所都道府県'] = findValue('住所都道府県', '都道府県');
  normalized['住所市町村以降'] = findValue('住所市町村以降', '市区町村以降', '住所');
  normalized['氏名(漢字)'] = findValue('氏名(漢字)', '氏名', '労働者氏名', 'worker_name');
  normalized['性別(男性は1、女性は3)'] = findValue('性別(男性は1、女性は3)', '性別', 'sex');
  normalized['生年月日の和暦(昭和5, 平成7, 令和9)'] = findValue('生年月日の和暦(昭和5, 平成7, 令和9)', '生年月日和暦');
  normalized['氏名フリガナ(全角カタカナ・姓と名の間にスペース)'] = findValue('氏名フリガナ(全角カタカナ・姓と名の間にスペース)', '氏名フリガナ', 'フリガナ');
  normalized['年齢(数字のみ)'] = findValue('年齢(数字のみ)', '年齢', 'age');
  normalized['住所都道府県フリガナ'] = findValue('住所都道府県フリガナ', '都道府県フリガナ');
  normalized['住所市町村以降フリガナ'] = findValue('住所市町村以降フリガナ', '市区町村以降フリガナ');
  normalized['職種'] = findValue('職種', 'Job_type');
  normalized['災害の原因と発生状況'] = findValue('災害の原因と発生状況', '災害の原因及び発生状況', 'accident_detail');
  normalized['診療を受けた病院住所'] = findValue('診療を受けた病院住所', '病院住所');
  normalized['傷病の部位及び状態'] = findValue('傷病の部位及び状態', '傷病部位');
  normalized['その会社の電話番号'] = findValue('その会社の電話番号', '所属会社電話番号', '本人所属会社電話番号');

  return normalized;
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
      const val = formData[field.id];
      if (val === undefined || val === null || val === '') continue;

      const strVal = String(val);
      const fontSize = field.fontSize || 10;

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
      } else if (field.id === 'accident_detail' || field.id === 'Reason_for_transfer_to_another_hospital') {
        drawMultiLineText(page, strVal, field.x, field.y, 14, 28, 4, customFont, fontSize);
      } else if (field.id === 'Claim_Hospital_name') {
        drawMultiLineText(page, strVal, field.x, field.y, 11, 12, 2, customFont, 8);
      } else if (field.id === "Claimant's_address") {
        drawMultiLineText(page, strVal, field.x, field.y, 11, 18, 2, customFont, 8);
      } else if (!isForm5 && field.id === 'worker_name') {
        drawMultiLineText(page, strVal, field.x, field.y, 11, 10, 2, customFont, 8);
      } else {
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
 * 様式第5号 生成API用
 */
export async function generateForm5PDFs(inputText: any): Promise<PDFResult[]> {
  const parsedInput = parseInputText(inputText);
  const mappedData = buildForm5Data(parsedInput, false);

  const templatePdfBytes = loadTemplatePdf('form5.pdf');
  const fontBytes = loadFontFile();
  const schema = loadSchemaFile('5');

  const targets = [
    { filename: '様式5号（病院用）.pdf', type: 'hospital' },
    { filename: '様式5号（薬局用）.pdf', type: 'pharmacy' },
  ];

  const results: PDFResult[] = [];

  for (const target of targets) {
    const currentData = { ...mappedData };

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
 * 様式第6号 生成API用
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
      ...f5Mapped,
      ...baseData,
      "Claim_Hospital_name": transfer1.name,
      "Hospital_name": f5Mapped["Hospital_name"] || "",
      "Hospital_Address": f5Mapped["Hospital_Address"] || "",
      "Hospital_zip_first": f5Mapped["Hospital_zip_first"] || "",
      "Hospital_zip_last": f5Mapped["Hospital_zip_last"] || "",
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
      ...f5Mapped,
      ...baseData,
      "Claim_Hospital_name": transfer2.name,
      "Hospital_name": transfer1.name,
      "Hospital_Address": transfer1.address,
      "Hospital_zip_first": transfer1.zip?.first || "",
      "Hospital_zip_last": transfer1.zip?.last || "",
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