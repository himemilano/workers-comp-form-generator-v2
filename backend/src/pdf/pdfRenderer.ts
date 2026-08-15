import fs from "fs";
import path from "path";
import { generate } from "@pdfme/generator";

/**
 * テンプレートJSONとマッピングデータを読み込み、PDF Bufferを生成する
 */
export async function renderPdf(jsonFileName: string, mappedData: Record<string, string>): Promise<Buffer> {
  // ルート直下の schemas フォルダを探索する候補パス一覧
  const candidatePaths = [
    // カレントディレクトリがプロジェクトルートの場合
    path.join(process.cwd(), "schemas", jsonFileName),
    // カレントディレクトリが backend の場合
    path.join(process.cwd(), "..", "schemas", jsonFileName),
    // 実行ファイル (dist/pdf/pdfRenderer.js) の位置から遡った schemas
    path.join(__dirname, "..", "..", "..", "schemas", jsonFileName),
    path.join(__dirname, "..", "..", "schemas", jsonFileName),
  ];

  // 存在するパスを特定
  const jsonPath = candidatePaths.find((p) => fs.existsSync(p));

  if (!jsonPath) {
    throw new Error(
      `テンプレートファイル [${jsonFileName}] が見つかりません。探索パス: ${candidatePaths.join(" | ")}`
    );
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
