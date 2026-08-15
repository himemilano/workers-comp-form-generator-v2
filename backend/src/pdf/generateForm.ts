import { buildForm5Data } from "../rules/mappers/form5Mapper";
import { buildForm6Data } from "../rules/mappers/form6Mapper";
import { parseKeyValueText } from "../utils/textUtils";
import { renderPdf } from "./pdfRenderer";

/**
 * 様式第5号 PDF生成メイン処理
 * 病院用・薬局用の最大2枚のPDFを生成します。
 */
export async function generateForm5PDFs(inputText: string) {
  const rawInput = parseKeyValueText(inputText);

  // Form5 は病院用(hospital) と 薬局用(pharmacy) の2パターンを生成
  const hospitalData = buildForm5Data(rawInput, "hospital");
  const pharmacyData = buildForm5Data(rawInput, "pharmacy");

  const pdfResults = [];

  // 1. 病院用PDF生成
  const hospitalBuffer = await renderPdf("form5.json", hospitalData);
  pdfResults.push({
    filename: "様式第5号_療養補償給付たる療養の費用請求書_病院用.pdf",
    buffer: hospitalBuffer,
  });

  // 2. 薬局用データが存在する場合（薬局名入力がある等）、薬局用PDFも生成
  // ※必要に応じて薬局名チェック等の条件判定を挟むことも可能です
  const pharmacyBuffer = await renderPdf("form5.json", pharmacyData);
  pdfResults.push({
    filename: "様式第5号_療養補償給付たる療養の費用請求書_薬局用.pdf",
    buffer: pharmacyBuffer,
  });

  return pdfResults;
}

/**
 * 様式第6号 PDF生成メイン処理
 * 1回目転院（1枚目）、2回目転院（2枚目）のPDFを生成します。
 */
export async function generateForm6PDFs(form5InputText: string, form6InputText: string) {
  const form5Raw = parseKeyValueText(form5InputText);
  const form6Raw = parseKeyValueText(form6InputText);

  // Form6 マッパーを呼び出し（1枚目、および2回目転院があれば2枚目を取得）
  const mappedDataList = buildForm6Data(form5Raw, form6Raw);

  const pdfResults = [];
  for (let i = 0; i < mappedDataList.length; i++) {
    const mappedData = mappedDataList[i];
    const filename = i === 0
      ? "様式第6号_指定病院等変更届.pdf"
      : "様式第6号_指定病院等変更届_2回目.pdf";

    // テンプレート "form6.json" を使ってPDFを描画
    const buffer = await renderPdf("form6.json", mappedData);
    pdfResults.push({ filename, buffer });
  }

  return pdfResults;
}
