import fs from "fs";
import path from "path";
import { PDFDocument, PDFPage, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// 1. スキーマJSONの読み込み
const schemaPath = path.resolve(__dirname, "../../../schemas/form5.json");
const form5Config = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

// 2. テスト用ダミーデータ（Reactコンバーターが出力するJSON構造と完全同一）
const mockData: Record<string, any> = {
  // --- 表面 ---
  "Labor_insurance_No.": "12345678901234",
  "sex": "1",
  "Date_of_birth,Japanese_era": "5",
  "date_of_birth": "550515",
  "Date_of_injury": "080829",
  "Date_of_injury,Japanese_era": "9", // 自動設定（令和9）
  "Name_in_Katakana": "ロウドウ タロウ", // 濁点分離・最大16桁
  "worker_name": "労働 太郎",
  "age": "45",
  "zip_first": "123",
  "zip_last": "4567",
  "Personal_address_and_prefecture,and_phonetic_spelling": "トウキョウトチヨダク",
  "Personal_address_and_prefecture": "東京都千代田区",
  "Personal_address_in_kana": "カスミガセキ1-1-1",
  "Personal_address": "霞が関1-1-1",
  "Job_type": "製造作業員",
  "time_am": true, // AMに〇
  "disaster_hour": "10",
  "disaster_minute": "30",
  "itle_of_the_person_verifying_the_facts": "工場長",
  "Name_of_the_person_who_confirmed_the_facts": "確認 太郎",
  "accident_detail": "工場内での製品搬入作業中、重さ約15kgのダンボール箱を持ち上げた際、体制を崩して腰部を激しく捻傷した。",
  "Hospital_name": "東京労働病院",
  "Hospital_Address": "東京都千代田区大手町1-2-3",
  "Hospital_tel_area": "03",
  "Hospital_tel_city": "1234",
  "Hospital_tel_num": "5678",
  "Hospital_zip_first": "100",
  "Hospital_zip_last": "0001",
  "Location_and_condition_of_the_injury": "腰部捻挫（全治約2週間の見込み）",
  "Company_Name": "株式会社 労務コーポレーション",
  "Company_Address": "東京都千代田区丸の内1-1-1",
  "Representative's_name": "代表取締役 労務 花子",
  "Year_of_proof_of_fact": "08",
  "Month_of_Proof_of_Fact": "08",
  "The_day_of_proof_of_facts": "30",
  "Company_tel_area": "03",
  "Company_tel_city": "9876",
  "Company_tel_num": "5432",
  "Company_zip_first": "100",
  "Company_zip_last": "0002",
  "Area_of_the_Labor_Standards_Inspection_Office": "千代田",
  "Claim_Hospital_name": "東京労働", // 自動抽出値
  "Year_of_entry": "08",
  "onth_of_entry": "08",
  "Date_of_entry": "30",
  "claimant_tel_area": "090",
  "claimant_tel_city": "1234",
  "claimant_tel_num": "5678",
  "claimant_zip_first": "123", // 自動補完
  "claimant_zip_last": "4567", // 自動補完
  "Claimant's_address": "東京都千代田区霞が関1-1-1", // 自動結合
  "Claimant's_name": "労働 太郎", // 自動コピー

  // --- 裏面 (page2) ---
  "Multiple": "有", // 「有」なら〇を印字
  "Number_of_workplaces": "1",
  "Special_Insurance_num": "987654321",
  "Name_of_Special_Member_Organization": "特別加入団体名称",
  "Year_of_joining": "05",
  "Joining_Month": "04",
  "Joining_date": "01",
};

async function main() {
  const pdfPath = path.resolve(__dirname, `../../../templates/${form5Config.template}`);
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  pdfDoc.registerFontkit(fontkit);
  const fontPath = path.resolve(__dirname, "../fonts/IPAexGothic.ttf");
  const fontBytes = fs.readFileSync(fontPath);
  const customFont = await pdfDoc.embedFont(fontBytes);

  for (const pageConfig of form5Config.pages) {
    const pageIndex = pageConfig.page - 1;
    if (pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);

    for (const field of pageConfig.fields) {
      const value = mockData[field.id];

      // --- 【特殊処理1】 〇印（指定項目が true または "有" の場合） ---
      if ((field.type === "circle" || field.id.startsWith("time_")) && (value === true || value === "有")) {
        drawCircle(page, field.x, field.y, customFont, field.fontSize || 14);
        continue;
      }

      // --- 【特殊処理2】 複数行テキスト（災害発生状況・傷病部位など） ---
      if ((field.id === "accident_detail" || field.id === "Location_and_condition_of_the_injury") && value) {
        const maxChars = field.maxChars || 28;
        const lineHeight = field.lineHeight || 18;
        const maxLines = field.maxLines || 4;
        drawMultilineText(page, String(value), field.x, field.y, customFont, field.fontSize || 10, maxChars, lineHeight, maxLines);
        continue;
      }

      // --- 【特殊処理3】 ピッチ送り・マス目印字（スキーマに pitch があるか、特定ピッチ項目） ---
      if (field.pitch && value) {
        drawPitchText(page, String(value), field.x, field.y, customFont, field.fontSize || 10, field.pitch);
        continue;
      }

      // --- 【通常処理】 標準テキスト印字 ---
      if (value !== undefined && value !== null && value !== false) {
        page.drawText(String(value), {
          x: field.x,
          y: field.y,
          size: field.fontSize || 10,
          font: customFont,
        });
      }
    }
  }

  // 出力・保存処理
  const outputDir = path.resolve(__dirname, "../../../output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const bytes = await pdfDoc.save();
  const outputPath = path.join(outputDir, "form5_test.pdf");
  fs.writeFileSync(outputPath, bytes);

  console.log(`✅ テストPDF（表・裏面統合）が正常に生成されました: ${outputPath}`);
}

// ==========================================
// 🎨 描画用ヘルパー関数群
// ==========================================

/**
 * マス目や一定間隔で1文字ずつ送って印字する関数
 */
function drawPitchText(page: PDFPage, text: string, startX: number, startY: number, font: PDFFont, fontSize: number, pitch: number) {
  const cleanText = text.replace(/-/g, ""); // ハイフンは除去して詰める
  cleanText.split("").forEach((char, index) => {
    page.drawText(char, {
      x: startX + index * pitch,
      y: startY,
      size: fontSize,
      font,
    });
  });
}

/**
 * 長文を指定文字数で自動折り返し描画する関数
 */
function drawMultilineText(page: PDFPage, text: string, startX: number, startY: number, font: PDFFont, fontSize: number, maxChars: number, lineHeight: number, maxLines: number) {
  const lines: string[] = [];
  const rawLines = text.split("\n");
  for (const line of rawLines) {
    for (let i = 0; i < line.length; i += maxChars) {
      if (lines.length < maxLines) lines.push(line.substring(i, i + maxChars));
    }
  }
  lines.forEach((lineText, index) => {
    page.drawText(lineText, {
      x: startX,
      y: startY - index * lineHeight,
      size: fontSize,
      font,
    });
  });
}

/**
 * 指定位置に「〇」印を描画する関数
 */
function drawCircle(page: PDFPage, x: number, y: number, font: PDFFont, fontSize: number) {
  page.drawText("〇", { x, y, size: fontSize, font });
}

main().catch((err) => console.error(err));