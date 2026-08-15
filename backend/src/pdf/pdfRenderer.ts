import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * ファイルを複数ディレクトリから探索して取得するヘルパー関数
 */
function findFile(fileName: string): string {
  const candidatePaths = [
    path.join(process.cwd(), "schemas", fileName),
    path.join(process.cwd(), "public", fileName),
    path.join(process.cwd(), "public", "fonts", fileName),
    path.join(process.cwd(), "..", "schemas", fileName),
    path.join(process.cwd(), "..", "public", fileName),
    path.join(__dirname, "..", "..", "..", "schemas", fileName),
    path.join(__dirname, "..", "..", "schemas", fileName),
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

  // 2. 背景PDF (form5.pdf 等) の読み込み
  const pdfFileName = templateConfig.template || `${path.basename(jsonFileName, ".json")}.pdf`;
  const pdfPath = findFile(pdfFileName);
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // 3. 日本語フォントの登録 & 埋め込み
  pdfDoc.registerFontkit(fontkit);
  let fontPath: string;
  try {
    // 優先フォントファイルの探索（必要に応じて追加可能）
    fontPath = findFile("IPAexGothic.ttf");
  } catch {
    try {
      fontPath = findFile("NotoSansJP-Regular.ttf");
    } catch {
      // schemas や public 内にある .ttf / .otf ファイルを自動検索
      const searchDirs = [
        path.join(process.cwd(), "schemas"),
        path.join(process.cwd(), "public"),
        path.join(process.cwd(), "public", "fonts"),
      ];
      let matchedFont = "";
      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          const fontFile = files.find((f) => f.endsWith(".ttf") || f.endsWith(".otf"));
          if (fontFile) {
            matchedFont = path.join(dir, fontFile);
            break;
          }
        }
      }
      if (!matchedFont) {
        throw new Error("日本語フォントファイル (.ttf / .otf) が schemas または public ディレクトリ内に見つかりません。");
      }
      fontPath = matchedFont;
    }
  }

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
        const val = mappedData[field.id];
        if (!val) continue;

        const strVal = String(val);
        const fontSize = field.fontSize || 10;
        const x = field.x;
        const y = field.y;

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
        // 複数行・最大文字数指定（事故概要等）がある場合
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
        // 通常のテキスト描画
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
