import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * templates (PDF), schemas (JSON), backend/src/fonts (フォント) からファイルを探索する関数
 */
function findFile(fileName: string): string {
  const candidatePaths = [
    // 1. templates フォルダ内の探索 (背景PDFの置き場)
    path.join(process.cwd(), "templates", fileName),
    path.join(process.cwd(), "..", "templates", fileName),
    path.join(__dirname, "..", "..", "..", "templates", fileName),
    path.join(__dirname, "..", "..", "templates", fileName),

    // 2. schemas フォルダ内の探索 (JSON設定の置き場)
    path.join(process.cwd(), "schemas", fileName),
    path.join(process.cwd(), "..", "schemas", fileName),
    path.join(__dirname, "..", "..", "..", "schemas", fileName),
    path.join(__dirname, "..", "..", "schemas", fileName),

    // 3. backend/src/fonts フォルダ内の探索 (フォントの置き場)
    path.join(process.cwd(), "src", "fonts", fileName),
    path.join(process.cwd(), "backend", "src", "fonts", fileName),
    path.join(__dirname, "..", "fonts", fileName),
    path.join(__dirname, "..", "..", "src", "fonts", fileName),
  ];

  const foundPath = candidatePaths.find((p) => fs.existsSync(p));
  if (!foundPath) {
    throw new Error(`ファイル [${fileName}] が見つかりません。探索パス: ${candidatePaths.join(" | ")}`);
  }
  return foundPath;
}

/**
 * テンプレートJSONとマッピングデータを読み込み、pdf-lib で PDF Bufferを生成する
 */
export async function renderPdf(jsonFileName: string, mappedData: Record<string, string>): Promise<Buffer> {
  // 1. JSON テンプレートの読み込み
  const jsonPath = findFile(jsonFileName);
  const templateContent = fs.readFileSync(jsonPath, "utf-8");
  const templateConfig = JSON.parse(templateContent);

  // 2. 背景PDF (form5.pdf等) の読み込み
  const pdfFileName = templateConfig.template || `${path.basename(jsonFileName, ".json")}.pdf`;
  const pdfPath = findFile(pdfFileName);
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // 3. 日本語フォント (IPAexGothic.ttf) の登録 & 埋め込み
  pdfDoc.registerFontkit(fontkit);
  const fontPath = findFile("IPAexGothic.ttf");
  const fontBytes = fs.readFileSync(fontPath);
  const customFont = await pdfDoc.embedFont(fontBytes, { subset: true });

  const pages = pdfDoc.getPages();

  // 4. 各ページのフィールド描画
  if (Array.isArray(templateConfig.pages)) {
    for (const pageConfig of templateConfig.pages) {
      const pageIndex = pageConfig.page - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;
      const page = pages[pageIndex];

      if (!Array.isArray(pageConfig.fields)) continue;

      for (const field of pageConfig.fields) {
        let val = mappedData[field.id];
        if (!val) continue;

        let strVal = String(val);
        let fontSize = field.fontSize || 10;
        const x = field.x;
        const y = field.y;

        // --- 個別ピンポイント制御 (Form 5 等) ---

        // ① 事業場の名称及び使用者職氏名: 30文字を超えたらフォント縮小 (下限8pt)
        if (field.id === "Company_name_and_representative's_name" || field.id === "Company_Name") {
          if (strVal.length > 30) {
            fontSize = Math.max(8, fontSize * (30 / strVal.length));
          }
        }

        // ② 請求人住所: 25文字を超えたらフォント縮小 (下限8pt)
        if (field.id === "Claimant's_address") {
          if (strVal.length > 25) {
            fontSize = Math.max(8, fontSize * (25 / strVal.length));
          }
        }

        // ③ 請求先病院名: 末尾の病院・診療所・薬局・クリニックを削除、8文字で折り返し、詰めた行間(11pt)で印字
        if (field.id === "Claim_Hospital_name") {
          strVal = strVal.replace(/(病院|診療所|薬局|クリニック)$/, "");
          const maxChars = 8;
          const lineHeight = 11; // 1行目と2行目の間隔を自然な位置（11pt）に設定
          const lines: string[] = [];
          for (let i = 0; i < strVal.length; i += maxChars) {
            lines.push(strVal.substring(i, i + maxChars));
          }
          lines.forEach((lineText, lineIdx) => {
            page.drawText(lineText, {
              x: x,
              y: y - lineIdx * lineHeight,
              size: fontSize,
              font: customFont,
            });
          });
          continue; // 描画完了のため次のフィールドへ
        }

        // --- 通常描画ロジック ---

        // ピッチ指定（マス目印字）がある場合
        if (field.pitch) {
          for (let i = 0; i < strVal.length; i++) {
            page.drawText(strVal[i], {
              x: x + i * field.pitch,
              y: y,
              size: fontSize,
              font: customFont,
            });
          }
        }
        // 複数行・最大文字数指定（事故概要等、JSONでmaxCharsが指定されている場合）
        else if (field.maxChars && field.maxChars > 0) {
          const maxChars = field.maxChars;
          const lineHeight = field.lineHeight || fontSize * 1.5;
          const lines: string[] = [];
          for (let i = 0; i < strVal.length; i += maxChars) {
            lines.push(strVal.substring(i, i + maxChars));
          }
          lines.forEach((lineText, lineIdx) => {
            page.drawText(lineText, {
              x: x,
              y: y - lineIdx * lineHeight,
              size: fontSize,
              font: customFont,
            });
          });
        }
        // 通常の1行テキスト描画
        else {
          page.drawText(strVal, {
            x: x,
            y: y,
            size: fontSize,
            font: customFont,
          });
        }
      }
    }
  }

  const outputPdfBytes = await pdfDoc.save();
  return Buffer.from(outputPdfBytes);
}
