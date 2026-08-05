import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { PDFDocument, PDFPage, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const router = Router();

// --- ラベルとJSONキーのマッピング ---
const LABEL_TO_KEY: Record<string, string> = {
  "性別": "sex",
  "生年月日の和暦": "Date_of_birth,Japanese_era",
  "生年月日": "date_of_birth",
  "負傷年月日": "Date_of_injury",
  "氏名フリガナ": "Name_in_Katakana",
  "氏名(漢字)": "worker_name",
  "氏名": "worker_name",
  "年齢": "age",
  "本人郵便番号": "zip_code",
  "住所都道府県フリガナ": "Personal_address_and_prefecture,and_phonetic_spelling",
  "住所都道府県": "Personal_address_and_prefecture",
  "住所市町村以降フリガナ": "Personal_address_in_kana",
  "住所市町村以降": "Personal_address",
  "職種": "Job_type",
  "負傷時刻区分": "disaster_time_type",
  "負傷時刻(時)": "disaster_hour",
  "負傷時刻(分)": "disaster_minute",
  "災害の原因と発生状況": "accident_detail",
  "診療を受けた病院名": "Hospital_name",
  "診療を受けた病院住所": "Hospital_Address",
  "病院電話番号": "Hospital_tel",
  "病院郵便番号": "Hospital_zip",
  "傷病の部位及び状態": "Location_and_condition_of_the_injury",
  "記入日": "date_of_entry",
  "本人電話番号": "claimant_tel",
  "労働保険番号": "Labor_insurance_No.",
  "負傷を確認した人の職名": "itle_of_the_person_verifying_the_facts",
  "負傷を確認した人の氏名": "Name_of_the_person_who_confirmed_the_facts",
  "提出する会社名": "Company_Name",
  "提出する会社住所": "Company_Address",
  "代表者氏名": "Representative's_name",
  "会社証明日": "date_of_proof",
  "会社電話番号": "Company_tel",
  "会社郵便番号": "Company_zip",
  "本人の所属会社が上記と異なる場合": "Company_name_and_representative's_name",
  "所属会社が上記と異なる場合": "Company_name_and_representative's_name",
  "上記所属会社電話番号": "affiliated_company_tel",
  "所轄労基署エリア": "Area_of_the_Labor_Standards_Inspection_Office",
  "その他就業先が有る場合": "Multiple",
  "表面以外の就業先の数": "Number_of_workplaces",
  "特別加入の労働保険番号": "Special_Insurance_num",
  "労働保険事務組合等の名称": "Name_of_Special_Member_Organization",
  "特別加入日": "date_of_joining",
};

// --- 日付分解関数 (自由記入欄用: "令和8", "8", "19") ---
function parseJapaneseDate(dateStr: string) {
  if (!dateStr) return null;
  let era = "令和";
  const upperStr = dateStr.toUpperCase();
  if (dateStr.includes("平成") || upperStr.includes("H")) era = "平成";
  else if (dateStr.includes("昭和") || upperStr.includes("S")) era = "昭和";
  else if (dateStr.includes("大正") || upperStr.includes("T")) era = "大正";
  else if (dateStr.includes("令和") || upperStr.includes("R")) era = "令和";

  const matches = dateStr.match(/\d+/g);
  if (matches && matches.length >= 3) {
    return {
      year: `${era}${parseInt(matches[0], 10)}`,
      month: String(parseInt(matches[1], 10)),
      day: String(parseInt(matches[2], 10)),
    };
  }
  return null;
}

// --- カタカナ濁点分離 ---
function splitKatakanaDakuon(str: string): string[] {
  const result: string[] = [];
  const normalized = str.normalize("NFD");
  for (const char of normalized) {
    if (char === "\u3099") result.push("゛");
    else if (char === "\u309A") result.push("゜");
    else result.push(char);
  }
  return result;
}

// --- テキストからJSONデータを生成 ---
function parseTextToData(rawText: string): Record<string, any> {
  const lines = rawText.split("\n");
  const temp: Record<string, string> = {};
  let currentKey: string | null = null;

  for (const line of lines) {
    const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (match) {
      const rawLabel = match[1].trim();
      const val = match[2].trim();
      let foundKey: string | null = null;
      for (const [k, v] of Object.entries(LABEL_TO_KEY)) {
        if (rawLabel.startsWith(k) || k.startsWith(rawLabel)) {
          foundKey = v;
          break;
        }
      }
      if (foundKey) {
        currentKey = foundKey;
        if (val) temp[foundKey] = val;
      } else currentKey = null;
    } else if (currentKey && line.trim() && !line.startsWith("---") && !line.startsWith("■")) {
      temp[currentKey] = (temp[currentKey] ? temp[currentKey] + "\n" : "") + line.trim();
    }
  }

  const data: Record<string, any> = { ...temp };

  if (temp["Name_in_Katakana"]) {
    data["Name_in_Katakana"] = splitKatakanaDakuon(temp["Name_in_Katakana"]).slice(0, 16).join("");
  }
  if (temp["zip_code"] && temp["zip_code"].includes("-")) {
    const [f, l] = temp["zip_code"].split("-");
    data["zip_first"] = f; data["zip_last"] = l;
    data["claimant_zip_first"] = f; data["claimant_zip_last"] = l;
  }
  if (temp["disaster_time_type"] === "AM") data["time_am"] = true;
  if (temp["disaster_time_type"] === "PM") data["time_pm"] = true;

  if (temp["Hospital_tel"] && temp["Hospital_tel"].includes("-")) {
    const p = temp["Hospital_tel"].split("-");
    data["Hospital_tel_area"] = p[0]; data["Hospital_tel_city"] = p[1]; data["Hospital_tel_num"] = p[2];
  }
  if (temp["Company_tel"] && temp["Company_tel"].includes("-")) {
    const p = temp["Company_tel"].split("-");
    data["Company_tel_area"] = p[0]; data["Company_tel_city"] = p[1]; data["Company_tel_num"] = p[2];
  }
  if (temp["claimant_tel"] && temp["claimant_tel"].includes("-")) {
    const p = temp["claimant_tel"].split("-");
    data["claimant_tel_area"] = p[0]; data["claimant_tel_city"] = p[1]; data["claimant_tel_num"] = p[2];
  }

  // 日付パース（自由記入用）
  if (temp["date_of_proof"]) {
    const d = parseJapaneseDate(temp["date_of_proof"]);
    if (d) { data["Year_of_proof_of_fact"] = d.year; data["Month_of_Proof_of_Fact"] = d.month; data["The_day_of_proof_of_facts"] = d.day; }
  }
  if (temp["date_of_entry"]) {
    const d = parseJapaneseDate(temp["date_of_entry"]);
    if (d) { data["Year_of_entry"] = d.year; data["onth_of_entry"] = d.month; data["Date_of_entry"] = d.day; }
  }
  if (temp["date_of_joining"]) {
    const d = parseJapaneseDate(temp["date_of_joining"]);
    if (d) { data["Year_of_joining"] = d.year; data["Joining_Month"] = d.month; data["Joining_date"] = d.day; }
  }

  data["Date_of_injury,Japanese_era"] = "9";
  data["Claimant's_address"] = `${temp["Personal_address_and_prefecture"] || ""}${temp["Personal_address"] || ""}`;
  data["Claimant's_name"] = temp["worker_name"] || "";

  return data;
}

// --- PDF生成APIエンドポイント ---
router.post("/generate-pdf", async (req: Request, res: Response) => {
  try {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "テキストが空です" });

    const data = parseTextToData(rawText);

    // スキーマ & テンプレート読み込み
    const schemaPath = path.resolve(__dirname, "../../../schemas/form5.json");
    const form5Config = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    const pdfPath = path.resolve(__dirname, `../../../templates/${form5Config.template}`);
    const pdfBytes = fs.readFileSync(pdfPath);

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.resolve(__dirname, "../fonts/IPAexGothic.ttf");
    const customFont = await pdfDoc.embedFont(fs.readFileSync(fontPath));

    for (const pageConfig of form5Config.pages) {
      const pageIndex = pageConfig.page - 1;
      if (pageIndex >= pdfDoc.getPageCount()) continue;
      const page = pdfDoc.getPage(pageIndex);

      for (const field of pageConfig.fields) {
        const val = data[field.id];
        if (val === undefined || val === null || val === false) continue;

        if ((field.type === "circle" || field.id.startsWith("time_")) && (val === true || val === "有")) {
          page.drawText("〇", { x: field.x, y: field.y, size: field.fontSize || 14, font: customFont });
        } else if ((field.id === "accident_detail" || field.id === "Location_and_condition_of_the_injury")) {
          // 47文字折り返し
          const maxChars = field.maxChars || 47;
          const lineHeight = field.lineHeight || 16;
          const lines = String(val).split("\n");
          let lineIdx = 0;
          for (const line of lines) {
            for (let i = 0; i < line.length; i += maxChars) {
              page.drawText(line.substring(i, i + maxChars), {
                x: field.x,
                y: field.y - lineIdx * lineHeight,
                size: field.fontSize || 9,
                font: customFont,
              });
              lineIdx++;
            }
          }
        } else if (field.pitch) {
          // マス目印字
          const cleanText = String(val).replace(/-/g, "");
          cleanText.split("").forEach((char, idx) => {
            page.drawText(char, {
              x: field.x + idx * field.pitch,
              y: field.y,
              size: field.fontSize || 12,
              font: customFont,
            });
          });
        } else {
          // 通常テキスト
          page.drawText(String(val), {
            x: field.x,
            y: field.y,
            size: field.fontSize || 10,
            font: customFont,
          });
        }
      }
    }

    const outputPdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=form5.pdf");
    res.send(Buffer.from(outputPdfBytes));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "PDF生成エラー: " + err.message });
  }
});

export default router;