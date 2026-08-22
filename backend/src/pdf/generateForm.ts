import { buildForm5Data } from "../rules/mappers/form5Mapper";
import { buildForm6Data } from "../rules/mappers/form6Mapper";
import { parseKeyValueText } from "../rules/utils/textUtils";
import { renderPdf } from "./pdfRenderer";

/**
 * 様式第5号 PDF生成（Form 5専用）
 */
export async function generateForm5PDFs(inputText: string) {
  const rawInput = parseKeyValueText(inputText);

  const hospitalData = buildForm5Data(rawInput, "hospital");
  const pharmacyData = buildForm5Data(rawInput, "pharmacy");

  const pdfResults = [];

  // 病院用PDF描画
  const hospitalBuffer = await renderPdf("form5.json", hospitalData);
  pdfResults.push({
    filename: "様式第5号_病院用.pdf",
    buffer: hospitalBuffer,
  });

  // 薬局用PDF描画
  const pharmacyBuffer = await renderPdf("form5.json", pharmacyData);
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

  const pdfResults = [];
  for (let i = 0; i < mappedDataList.length; i++) {
    const mappedData = mappedDataList[i];
    const filename = i === 0
      ? "様式第6号_1回目.pdf"
      : "様式第6号_2回目.pdf";

    const buffer = await renderPdf("form6.json", mappedData);
    pdfResults.push({ filename, buffer });
  }

  return pdfResults;
}
