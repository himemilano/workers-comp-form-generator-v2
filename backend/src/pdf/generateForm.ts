ｚimport fs from "fs";
import path from "path";
import { buildForm5Data } from "../rules/mappers/form5Mapper";
import { buildForm6Data } from "../rules/mappers/form6Mapper";
import { parseKeyValueText } from "../rules/utils/textUtils";
import { renderPdf, PdfTemplateConfig } from "./pdfRenderer";

/**
 * プロジェクトルート（schemas や templates が存在する最上位階層）を取得する関数
 */
function getProjectRoot(): string {
  const cwd = process.cwd();
  // カレントディレクトリが backend で終わっている場合は、1つ上の親ディレクトリをルートとする
  if (cwd.endsWith("backend") || cwd.endsWith("backend/")) {
    return path.resolve(cwd, "..");
  }
  return cwd;
}

/**
 * ルート直下の schemas ディレクトリからJSON設定ファイルを読み込む関数
 */
function getTemplateConfig(jsonFileName: string): PdfTemplateConfig {
  const projectRoot = getProjectRoot();
  const jsonPath = path.join(projectRoot, "schemas", jsonFileName);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`[Schema Error]: 設定ファイルが見つかりません: ${jsonPath}`);
  }

  const jsonRaw = fs.readFileSync(jsonPath, "utf-8");
  return JSON.parse(jsonRaw) as PdfTemplateConfig;
}

/**
 * 様式第5号 PDF生成（Form 5専用）
 */
export async function generateForm5PDFs(inputText: string) {
  const rawInput = parseKeyValueText(inputText);

  const hospitalData = buildForm5Data(rawInput, "hospital");
  const pharmacyData = buildForm5Data(rawInput, "pharmacy");

  const templateConfig = getTemplateConfig("form5.json");

  const pdfResults = [];

  const hospitalBuffer = await renderPdf(templateConfig, hospitalData, "form5.json");
  pdfResults.push({
    filename: "様式第5号_病院用.pdf",
    buffer: hospitalBuffer,
  });

  const pharmacyBuffer = await renderPdf(templateConfig, pharmacyData, "form5.json");
  pdfResults.push({
    filename: "様式第5号_薬局用.pdf",
    buffer: pharmacyBuffer,
  });

  return pdfResults;
}

/**
 * 様式第6号 PDF生成（Form 6専用）
 */
export async function generateForm6PDFs(form5InputText: string, form6InputText: string) {
  const form5Raw = parseKeyValueText(form5InputText);
  const form6Raw = parseKeyValueText(form6InputText);

  const mappedDataList = buildForm6Data(form5Raw, form6Raw);

  const templateConfig = getTemplateConfig("form6.json");

  const pdfResults = [];
  for (let i = 0; i < mappedDataList.length; i++) {
    const mappedData = mappedDataList[i];
    const filename = i === 0
      ? "様式第6号_1回目.pdf"
      : "様式第6号_2回目.pdf";

    const buffer = await renderPdf(templateConfig, mappedData, "form6.json");
    pdfResults.push({ filename, buffer });
  }

  return pdfResults;
}
