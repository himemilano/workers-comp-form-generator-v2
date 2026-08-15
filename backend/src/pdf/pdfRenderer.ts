import fs from "fs";
import path from "path";
import { generate } from "@pdfme/generator";

/**
 * テンプレートJSONとマッピングデータを読み込み、PDF Bufferを生成する
 */
export async function renderPdf(jsonFileName: string, mappedData: Record<string, string>): Promise<Buffer> {
  // テンプレートJSONのパス（project_root/public/ などを想定）
  const jsonPath = path.join(process.cwd(), "public", jsonFileName);
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`テンプレートファイルが見つかりません: ${jsonPath}`);
  }

  const templateContent = fs.readFileSync(jsonPath, "utf-8");
  const template = JSON.parse(templateContent);

  // pdfme を使用して PDF を生成
  const pdfBytes = await generate({
    template,
    inputs: [mappedData],
  });

  return Buffer.from(pdfBytes);
}
