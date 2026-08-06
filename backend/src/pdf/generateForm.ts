import { PDFDocument, rgb, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// --- 型定義 ---
interface FieldSchema {
  id: string;
  page: number;
  x: number;
  y: number;
  fontSize?: number;
}

interface FormSchema {
  form: string;
  name: string;
  template: string;
  pages: {
    page: number;
    name: string;
    fields: FieldSchema[];
  }[];
}

// --- ユーティリティ関数 ---

/**
 * 濁点・半濁点を分離する（例: "ギ" -> "キ", "゛"）
 */
function normalizeKatakana(str: string): string[] {
  const normalized = str.normalize('NFD');
  const result: string[] = [];
  for (const char of normalized) {
    if (char === '\u3099') {
      result.push('゛');
    } else if (char === '\u309A') {
      result.push('ﾟ');
    } else {
      result.push(char);
    }
  }
  return result;
}

/**
 * マス目用に1文字ずつ間隔を開けて描画する
 */
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
 * 長文を複数行に自動折り返して描画する（最大4行）
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

/**
 * Form 5 の入力データ補完・前処理
 */
export function processForm5Data(rawInput: Record<string, any>): Record<string, any> {
  const data = { ...rawInput };

  // 1. 固定・補完ルール
  data['Date_of_injury,Japanese_era'] = '9'; // 令和固定
  data['claimant_zip_first'] = data['zip_first'] || '';
  data['claimant_zip_last'] = data['zip_last'] || '';
  data["Claimant's_address"] = `${data['Personal_address_and_prefecture'] || ''}${data['Personal_address'] || ''}`;
  data["Claimant's_name"] = data['worker_name'] || '';

  // 2. AM/PM の 〇 表示ロジック
  if (data['time_am_pm'] === 'AM' || data['time_am']) {
    data['time_am'] = '〇';
  } else if (data['time_am_pm'] === 'PM' || data['time_pm']) {
    data['time_pm'] = '〇';
  }

  // 3. 裏面（Multiple）の 〇 表示
  if (data['Multiple'] === '有') {
    data['Multiple'] = '〇';
  }

  return data;
}

/**
 * Form 6 用のデータ連動・マッピング処理
 */
export function processForm6DataFromForm5(f5Data: Record<string, any>, f6Input: Record<string, any>): Record<string, any> {
  const data: Record<string, any> = { ...f6Input };

  // Form 5 からの引き継ぎ項目
  data['Area_of\u200b_the_Labor_Standards_Inspection_Office'] = f5Data['Area_of\u200b_the_Labor_Standards_Inspection_Office'];
  data['Claim_Hospital_name'] = f5Data['Claim_Hospital_name'];
  data['Year_of_entry'] = f5Data['Year_of_entry'];
  data['Month_of_entry'] = f5Data['Month_of_entry'];
  data['Date_of_entry'] = f5Data['Date_of_entry'];
  data['zip_first'] = f5Data['zip_first'];
  data['zip_last'] = f5Data['zip_last'];
  data['claimant_tel_area'] = f5Data['claimant_tel_area'];
  data['claimant_tel_city'] = f5Data['claimant_tel_city'];
  data['claimant_tel_num'] = f5Data['claimant_tel_num'];
  
  data['Address_of_the_person_filing_the_notification'] = f5Data["Claimant's_address"];
  data['Name_of_the_person_filing_the_notification'] = f5Data['worker_name'];

  // 労働保険番号の分割
  const laborNo = f5Data['Labor_insurance_No.'] || '';
  data['Labor_insurance_No._first'] = laborNo.substring(0, 2);
  data['Labor_insurance_No._last'] = laborNo.substring(2);

  data['worker_name'] = f5Data['worker_name'];

  // 性別 〇 印判定
  if (String(f5Data['sex']) === '1') data['male'] = '〇';
  if (String(f5Data['sex']) === '3') data['female'] = '〇';

  // 生年月日変換 (5:昭和, 7:平成, 9:令和)
  const eraMap: Record<string, string> = { '5': '昭和', '7': '平成', '9': '令和' };
  const era = eraMap[String(f5Data['Date_of_birth,Japanese_era'])] || '';
  const dob = String(f5Data['date_of_birth'] || '');
  if (dob.length === 6) {
    data['Year of birth'] = `${era}${dob.substring(0, 2)}年`;
    data['Birth_month'] = String(parseInt(dob.substring(2, 4), 10)); // 先頭の0を除去
    data['Birth_day'] = String(parseInt(dob.substring(4, 6), 10));   // 先頭の0を除去
  }

  data['age'] = f5Data['age'];
  data["Claimant's_address"] = f5Data["Claimant's_address"];
  data['Job_type'] = f5Data['Job_type'];

  // 負傷年月日変換
  const doi = String(f5Data['Date_of_injury'] || '');
  if (doi.length === 6) {
    data['injury_year'] = `令和${doi.substring(0, 2)}`;
    data['injury_month'] = String(parseInt(doi.substring(2, 4), 10));
    data['injury_day'] = String(parseInt(doi.substring(4, 6), 10));
  }

  // 負傷時間区分
  if (f5Data['time_am'] === '〇') data['injury_time_am'] = '〇';
  if (f5Data['time_pm'] === '〇') data['injury_time_pm'] = '〇';

  data['disaster_hour'] = f5Data['disaster_hour'];
  data['disaster_minute'] = f5Data['disaster_minute'];
  data['accident_detail'] = f5Data['accident_detail'];

  // 会社・病院情報のコピー
  data['Year_of_proof_of_fact'] = f5Data['Year_of_proof_of_fact'];
  data['Month_of_Proof_of_Fact'] = f5Data['Month_of_Proof_of_Fact'];
  data['The_day_of_proof_of_fact'] = f5Data['The_day_of_proof_of_facts'];

  data['Company_Name'] = f5Data['Company_Name'];
  data['Company_zip_first'] = f5Data['Company_zip_first'];
  data['Company_zip_last'] = f5Data['Company_zip_last'];
  data['Company_tel_area'] = f5Data['Company_tel_area'];
  data['Company_tel_city'] = f5Data['Company_tel_city'];
  data['Company_tel_num'] = f5Data['Company_tel_num'];
  data['Company_Address'] = f5Data['Company_Address'];
  data["Representative's_name"] = f5Data["Representative's_name"];

  data['Hospital_name'] = f5Data['Hospital_name'];
  data['Hospital_Address'] = f5Data['Hospital_Address'];
  data['Hospital_zip_first'] = f5Data['Hospital_zip_first'];
  data['Hospital_zip_last'] = f5Data['Hospital_zip_last'];
  data['Location_and_condition_of_the_injury'] = f5Data['Location_and_condition_of_the_injury'];

  return data;
}

// --- メインPDF生成関数 ---
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
      const val = formData[field.id];

      // 未入力（null, undefined, 空文字）は完全にスキップ
      if (val === undefined || val === null || val === '') {
        continue;
      }

      const strVal = String(val);
      const fontSize = field.fontSize || 10;

      // 1. マス目（1文字ずつずらして描画）項目の判定
      if (field.id === 'Labor_insurance_No.') {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 14);
      } else if (field.id === 'date_of_birth' || field.id === 'Date_of_injury') {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 6);
      } else if (field.id === 'Name_in_Katakana') {
        const kanaChars = normalizeKatakana(strVal);
        drawSpacedText(page, kanaChars.join(''), field.x, field.y, 13.5, customFont, fontSize, 16);
      } else if (field.id === 'zip_first' || field.id === 'Hospital_zip_first' || field.id === 'Company_zip_first' || field.id === 'claimant_zip_first') {
        drawSpacedText(page, strVal, field.x, field.y, 12.0, customFont, fontSize, 3);
      } else if (field.id === 'zip_last' || field.id === 'Hospital_zip_last' || field.id === 'Company_zip_last' || field.id === 'claimant_zip_last') {
        drawSpacedText(page, strVal, field.x, field.y, 12.0, customFont, fontSize, 4);
      } 
      // Form 6 固有のマス目項目
      else if (field.id === 'Labor_insurance_No._first') {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 2);
      } else if (field.id === 'Labor_insurance_No._last') {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 12);
      } else if (field.id === 'Pension_certificate_jurisdiction') {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 2);
      } else if (field.id === 'Pension certificate number') {
        drawSpacedText(page, strVal, field.x, field.y, 14.2, customFont, fontSize, 10);
      }

      // 2. 長文自動改行（4行以内）項目の判定
      else if (field.id === 'accident_detail' || field.id === 'Reason_for_transfer_to_another_hospital') {
        drawMultiLineText(page, strVal, field.x, field.y, 14, 28, 4, customFont, fontSize);
      }

      // 3. 通常テキスト描画（住所・病院名・氏名など）
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