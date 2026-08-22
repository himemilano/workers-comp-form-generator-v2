import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

export interface PdfFieldConfig {
  id: string;
  x: number;
  y: number;
  fontSize?: number;
  pitch?: number;
  maxLen?: number;
  maxChars?: number;
  lineHeight?: number;
  autoShrink?: boolean;
}

export interface PageConfig {
  page: number;
  fields: PdfFieldConfig[];
}

export interface PdfTemplateConfig {
  form: string;
  pdfTemplate: string;
  fontPath: string;
  pages: PageConfig[];
}

/**
 * プロジェクトルート（schemas や templates が存在する最上位階層）を取得する関数
 */
function getProjectRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("backend") || cwd.endsWith("backend/")) {
    return path.resolve(cwd, "..");
  }
  return cwd;
}

/**
 * PDFフォームにデータを描画してバイナリを返すメイン関数
 */
export async function renderPdf(
  templateConfig: PdfTemplateConfig,
  mappedData: Record<string, any>,
  jsonFileName: string = ""
): Promise<Uint8Array> {
  const projectRoot = getProjectRoot();

  // テンプレートPDFのパス解決（プロジェクトルート基準）
  const pdfPath = path.isAbsolute(templateConfig.pdfTemplate)
    ? templateConfig.pdfTemplate
    : path.join(projectRoot, templateConfig.pdfTemplate);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`[PDF Template Error]: テンプレートPDFが見つかりません: ${pdfPath}`);
  }
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // フォントのパス解決（プロジェクトルート基準）
  pdfDoc.registerFontkit(fontkit);
  const fontPath = path.isAbsolute(templateConfig.fontPath)
    ? templateConfig.fontPath
    : path.join(projectRoot, templateConfig.fontPath);

  if (!fs.existsSync(fontPath)) {
    throw new Error(`[Font Error]: フォントファイルが見つかりません: ${fontPath}`);
  }
  const fontBytes = fs.readFileSync(fontPath);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();

  // ★ Form 5 かどうかの判定ガード（Form 5 の挙動を100%保持するため）
  const isForm5 = jsonFileName.includes("form5") || templateConfig.form === "5";

  for (const pageConfig of templateConfig.pages) {
    const pageIndex = pageConfig.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];

    for (const field of pageConfig.fields) {
      let val = mappedData[field.id];
      if (val === undefined || val === null || val === "") continue;

      let strVal = String(val);
      let fontSize = field.fontSize || 10;
      const x = field.x;
      const y = field.y;

      // --- ① Form 5 専用の既存ピンポイント制御（Form 5 実行時のみ通過） ---
      if (isForm5) {
        // 1. 事業場名称・代表者名: 30文字超で自動縮小
        if (
          field.id === "Company_name_and_representative's_name" ||
          field.id === "Company_Name"
        ) {
          if (strVal.length > 30) {
            fontSize = Math.max(8, fontSize * (30 / strVal.length));
          }
        }

        // 2. 請求人住所: 25文字超で自動縮小
        if (field.id === "Claimant's_address") {
          if (strVal.length > 25) {
            fontSize = Math.max(8, fontSize * (25 / strVal.length));
          }
        }

        // 3. 請求先病院名: 8文字折り返し & 行間11pt（Form 5 のみ適用）
        if (field.id === "Claim_Hospital_name") {
          strVal = strVal.replace(/(病院|診療所|薬局|クリニック)$/, "");
          const maxChars = 8;
          const lineHeight = 11;
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
          continue; // Form 5 の病院名描画完了
        }
      }

      // --- ② 汎用自動縮小（Form 6 または Form 5 の共通設定） ---
      if (field.autoShrink && field.maxLen && strVal.length > field.maxLen) {
        fontSize = Math.max(8, fontSize * (field.maxLen / strVal.length));
      }

      // --- ③ 描画処理 ---

      // A. ピッチ指定（マス目印字）
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
      // B. 複数行描画（\n が含まれる、または JSON で maxChars が指定されている場合）
      else if (strVal.includes("\n") || (field.maxChars && field.maxChars > 0)) {
        // JSON側の lineHeight を優先（無ければ fontSize * 1.2）
        const lineHeight = field.lineHeight ? Number(field.lineHeight) : fontSize * 1.2;
        let lines: string[] = [];

        if (strVal.includes("\n")) {
          lines = strVal.split("\n");
        } else if (field.maxChars) {
          for (let i = 0; i < strVal.length; i += field.maxChars) {
            lines.push(strVal.substring(i, i + field.maxChars));
          }
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
      // C. 通常の1行テキスト描画（Form 6 の Claim_Hospital_name はこちらを通る）
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

  return await pdfDoc.save();
}
