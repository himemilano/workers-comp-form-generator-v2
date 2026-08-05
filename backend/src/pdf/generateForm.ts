import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { parseKeyValueText, splitZipCode, splitTelNumber } from "./parser";

// ディレクトリパス設定
const rootDir = path.resolve(__dirname, "../../..");
const schemasDir = path.join(rootDir, "schemas");
const templatesDir = path.join(rootDir, "templates");
const fontsDir = path.join(__dirname, "../fonts");
const outputDir = path.join(rootDir, "output");

/**
 * 単一のPDFを生成する内部コア関数
 */
async function renderSinglePdf(formType: "form5" | "form6", data: Record<string, any>): Promise<Buffer> {
  const templatePath = path.join(templatesDir, `${formType}.pdf`);
  const schemaPath = path.join(schemasDir, `${formType}.json`);
  const fontPath = path.join(fontsDir, "IPAexGothic.ttf");

  const pdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync(fontPath);
  const customFont = await pdfDoc.embedFont(fontBytes);
  const page = pdfDoc.getPages()[0];
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

  // スキーマの座標に従ってデータを出力
  for (const item of schema) {
    const val = data[item.id];
    if (val === undefined || val === null || val === "") continue;

    const x = item.x;
    const y = item.y;
    const fontSize = item.fontSize || 10;

    // 〇印の描画処理
    if (item.type === "circle" || val === "〇") {
      page.drawText("〇", { x, y, size: fontSize, font: customFont, color: rgb(0, 0, 0) });
      continue;
    }

    // マス目（数字の1文字ずつズレ配置）処理
    if (item.letterSpacing && item.letterSpacing > 0) {
      const strVal = String(val);
      for (let i = 0; i < strVal.length; i++) {
        page.drawText(strVal[i], {
          x: x + i * item.letterSpacing,
          y: y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
      }
      continue;
    }

    // 通常テキスト描画（折り返し対応）
    const strVal = String(val);
    if (item.maxLineWidth && strVal.length > 20) {
      // 簡易折り返しロジック（4行まで）
      const chunkSize = item.chunkSize || 22;
      const lines = strVal.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [strVal];
      lines.slice(0, 4).forEach((lineText, idx) => {
        page.drawText(lineText, {
          x: x,
          y: y - idx * (fontSize + 2),
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
      });
    } else {
      page.drawText(strVal, { x, y, size: fontSize, font: customFont, color: rgb(0, 0, 0) });
    }
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

/**
 * 様式第5号（Form 5）生成メイン処理
 * 薬局情報がある場合は「病院用」「薬局用」の最大2枚を出力
 */
export async function generateForm5PDFs(inputText: string): Promise<{ filename: string; buffer: Buffer }[]> {
  const parsed = parseKeyValueText(inputText);
  const results: { filename: string; buffer: Buffer }[] = [];

  const zip = splitZipCode(parsed["本人郵便番号(例: 123-4567)"]);
  const tel = splitTelNumber(parsed["本人電話番号(例: 090-1234-5678)"]);
  const hospZip = splitZipCode(parsed["診療を受けた病院郵便番号(例: 100-0001)"]);
  const hospTel = splitTelNumber(parsed["病院電話番号(例: 03-1234-5678)"]);

  // 基本データ構造
  const baseData: Record<string, any> = {
    worker_name: parsed["氏名(漢字)"],
    sex: parsed["性別(男性は1、女性は3)"],
    Japanese_era: parsed["生年月日の和暦(昭和5, 平成7, 令和9)"],
    Date_of_birth: parsed["生年月日(例: 55年5月15日→550515)"],
    age: parsed["年齢(数字のみ)"],
    "Claimant's_address": (parsed["住所都道府県"] || "") + (parsed["住所市町村以降"] || ""),
    Job_type: parsed["職種"],
    Date_of_injury: parsed["負傷年月日(例: 令和8年8月29日→080829)"],
    disaster_time_type: parsed["負傷時刻区分(AM または PM)"],
    disaster_hour: parsed["負傷時刻(時)"],
    disaster_minute: parsed["負傷時刻(分)"],
    accident_detail: parsed["災害の原因と発生状況"],
    Claim_Hospital_name: parsed["診療を受けた病院名"],
    Hospital_name: parsed["診療を受けた病院名"],
    Hospital_Address: parsed["診療を受けた病院住所"],
    Hospital_zip_first: hospZip.first,
    Hospital_zip_last: hospZip.last,
    Location_and_condition_of_the_injury: parsed["傷病の部位及び状態"],
  };

  // ① 病院用PDF生成
  const hospitalBuffer = await renderSinglePdf("form5", baseData);
  results.push({ filename: "form5_病院用.pdf", buffer: hospitalBuffer });

  // ② 薬局情報が存在する場合は薬局用PDFも生成
  if (parsed["調剤を受けた薬局名"]) {
    const pharmZip = splitZipCode(parsed["薬局の郵便番号(例: 100-0001)"]);
    const pharmacyData = {
      ...baseData,
      Claim_Hospital_name: parsed["調剤を受けた薬局名"],
      Hospital_name: parsed["調剤を受けた薬局名"],
      Hospital_Address: parsed["薬局の住所"],
      Hospital_zip_first: pharmZip.first,
      Hospital_zip_last: pharmZip.last,
    };
    const pharmacyBuffer = await renderSinglePdf("form5", pharmacyData);
    results.push({ filename: "form5_薬局用.pdf", buffer: pharmacyBuffer });
  }

  return results;
}

/**
 * 様式第6号（Form 6）生成メイン処理
 * 転院情報（1回目・2回目）に応じて最大2枚をリレー生成
 */
export async function generateForm6PDFs(
  form5InputText: string,
  form6InputText: string
): Promise<{ filename: string; buffer: Buffer }[]> {
  const f5Parsed = parseKeyValueText(form5InputText);
  const f6Parsed = parseKeyValueText(form6InputText);
  const results: { filename: string; buffer: Buffer }[] = [];

  const initialHospitalName = f5Parsed["診療を受けた病院名"];
  const claimantAddress = (f5Parsed["住所都道府県"] || "") + (f5Parsed["住所市町村以降"] || "");

  // Form5から引き継ぐ共通データ
  const commonBase = {
    worker_name: f5Parsed["氏名(漢字)"],
    Name_of_the_person_filing_the_notification: f5Parsed["氏名(漢字)"],
    Address_of_the_person_filing_the_notification: claimantAddress,
    "Claimant's_address": claimantAddress,
    sex: f5Parsed["性別(男性は1、女性は3)"],
    Date_of_birth: f5Parsed["生年月日(例: 55年5月15日→550515)"],
    Japanese_era: f5Parsed["生年月日の和暦(昭和5, 平成7, 令和9)"],
    age: f5Parsed["年齢(数字のみ)"],
    Job_type: f5Parsed["職種"],
    Date_of_injury: f5Parsed["負傷年月日(例: 令和8年8月29日→080829)"],
    disaster_time_type: f5Parsed["負傷時刻区分(AM または PM)"],
    disaster_hour: f5Parsed["負傷時刻(時)"],
    disaster_minute: f5Parsed["負傷時刻(分)"],
    accident_detail: f5Parsed["災害の原因と発生状況"],
    Pension_certificate_jurisdiction: f6Parsed["年金証書番号(管轄局・最初の2桁)"],
    Pension_certificate_type: f6Parsed["年金証書番号(種別・3桁目)"],
    "Pension certificate number": f6Parsed["年金証書番号(4桁目以降)"],
  };

  // ① 1回目の転院PDF（初診病院 → 1回目の転院先）
  if (f6Parsed["1回目の転院先病院名"]) {
    const transfer1Zip = splitZipCode(f6Parsed["1回目の病院の郵便番号(例: 123-4567)"]);
    const form6_1_Data = {
      ...commonBase,
      Claim_Hospital_name: initialHospitalName, // 変更前
      Hospital_after_transfer: f6Parsed["1回目の転院先病院名"], // 変更後
      Address_of_the_hospital_after_transfer: f6Parsed["1回目の病院の住所"],
      Postal_code_first_of_the_hospital_after_transfer: transfer1Zip.first,
      Postal_code_last_of_the_hospital_after_transfer: transfer1Zip.last,
      Reason_for_transfer_to_another_hospital: f6Parsed["1回目の転院理由(例: 精密検査・手術入院加療のため、自宅近くで通院するため 等)"],
    };
    const buffer1 = await renderSinglePdf("form6", form6_1_Data);
    results.push({ filename: "form6_1回目の転院.pdf", buffer: buffer1 });
  }

  // ② 2回目の転院PDF（1回目の転院先 → 2回目の転院先）
  if (f6Parsed["2回目の転院先病院名"]) {
    const transfer2Zip = splitZipCode(f6Parsed["2回目の病院の郵便番号(例: 123-4567)"]);
    const form6_2_Data = {
      ...commonBase,
      Claim_Hospital_name: f6Parsed["1回目の転院先病院名"], // 変更前（スライド）
      Hospital_after_transfer: f6Parsed["2回目の転院先病院名"], // 変更後
      Address_of_the_hospital_after_transfer: f6Parsed["2回目の病院の住所"],
      Postal_code_first_of_the_hospital_after_transfer: transfer2Zip.first,
      Postal_code_last_of_the_hospital_after_transfer: transfer2Zip.last,
      Reason_for_transfer_to_another_hospital: f6Parsed["2回目の転院理由(例: 退院後、自宅近くでリハビリ通院を行うため 等)"],
    };
    const buffer2 = await renderSinglePdf("form6", form6_2_Data);
    results.push({ filename: "form6_2回目の転院.pdf", buffer: buffer2 });
  }

  return results;
}

// ---------------------------------------------------------
// CLIテスト用実行ブロック (npx ts-node generateForm.ts で動作)
// ---------------------------------------------------------
if (require.main === module) {
  (async () => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    console.log("PDF生成テストを開始します...");

    // テスト用のサンプル入力テキスト
    const sampleForm5Text = `
性別(男性は1、女性は3) : 1
生年月日の和暦(昭和5, 平成7, 令和9) : 7
生年月日(例: 55年5月15日→550515) : 020401
負傷年月日(例: 令和8年8月29日→080829) : 080801
氏名(漢字) : 労災 太郎
年齢(数字のみ) : 26
本人郵便番号(例: 123-4567) : 100-0001
住所都道府県 : 東京都
住所市町村以降 : 千代田区1-1-1
職種 : 開発エンジニア
負傷時刻区分(AM または PM) : AM
負傷時刻(時) : 9
負傷時刻(分) : 30
災害の原因と発生状況 : 通勤途中に階段を踏み外して足首を捻挫した。
診療を受けた病院名 : 〇〇救急病院
診療を受けた病院郵便番号(例: 100-0001) : 100-0002
診療を受けた病院住所 : 東京都千代田区2-2-2
調剤を受けた薬局名 : △△調剤薬局
薬局の郵便番号(例: 100-0001) : 100-0003
薬局の住所 : 東京都千代田区3-3-3
`;

    const sampleForm6Text = `
1回目の転院先病院名 : ◇◇整形外科病院
1回目の病院の郵便番号(例: 123-4567) : 100-0004
1回目の病院の住所 : 東京都千代田区4-4-4
1回目の転院理由(例: 精密検査・手術入院加療のため、自宅近くで通院するため 等) : 精密検査および手術入院加療のため。

2回目の転院先病院名 : ☆☆リハビリクリニック
2回目の病院の郵便番号(例: 123-4567) : 100-0005
2回目の病院の住所 : 東京都千代田区5-5-5
2回目の転院理由(例: 退院後、自宅近くでリハビリ通院を行うため 等) : 退院後、自宅近くで経過観察およびリハビリ通院を行うため。
`;

    // Form5 のテスト
    const f5Outputs = await generateForm5PDFs(sampleForm5Text);
    for (const out of f5Outputs) {
      fs.writeFileSync(path.join(outputDir, out.filename), out.buffer);
      console.log(`生成完了: output/${out.filename}`);
    }

    // Form6 のテスト
    const f6Outputs = await generateForm6PDFs(sampleForm5Text, sampleForm6Text);
    for (const out of f6Outputs) {
      fs.writeFileSync(path.join(outputDir, out.filename), out.buffer);
      console.log(`生成完了: output/${out.filename}`);
    }
  })();
}