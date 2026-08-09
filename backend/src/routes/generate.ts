import { Router, Request, Response } from "express";
import { generateForm5PDFs, generateForm6PDFs } from "../pdf/generateForm";

const router = Router();

/**
 * 様式第5号 生成API
 * POST /api/form5
 */
router.post("/form5", async (req: Request, res: Response) => {
  try {
    const { inputText } = req.body;

    console.log("📥 [API /form5] リクエスト受信");
    console.log(" - inputText 型:", typeof inputText);

    if (!inputText) {
      console.warn("⚠️ [API /form5] inputText が空です");
      return res.status(400).json({ error: "入力テキスト(inputText)が空です" });
    }

    // 最新の生成ロジック呼び出し（病院用・薬局用）
    const pdfResults: any[] = await generateForm5PDFs(inputText);

    if (!pdfResults || pdfResults.length === 0) {
      return res.status(500).json({ error: "様式5号のPDF生成結果が0件です" });
    }

    const files = pdfResults.map((item: any) => ({
      filename: item.filename,
      base64: Buffer.isBuffer(item.buffer)
        ? item.buffer.toString("base64")
        : Buffer.from(item.buffer).toString("base64"),
      contentType: "application/pdf",
    }));

    console.log(`✅ [API /form5] 正常完了: ${files.length}件のPDFを出力しました`);
    return res.json({ success: true, files });
  } catch (error: any) {
    console.error("❌ [API /form5] 生成エラー:", error);
    return res.status(500).json({
      error: "様式5号のPDF生成に失敗しました",
      details: error.message,
    });
  }
});

/**
 * 様式第6号 生成API
 * POST /api/form6
 */
router.post("/form6", async (req: Request, res: Response) => {
  try {
    const { form5InputText, form6InputText } = req.body;

    console.log("📥 [API /form6] リクエスト受信");
    console.log(" - form5InputText 型:", typeof form5InputText);
    console.log(" - form6InputText 型:", typeof form6InputText);

    if (!form5InputText || !form6InputText) {
      console.warn("⚠️ [API /form6] パラメータ不足");
      return res.status(400).json({
        error: "form5InputText または form6InputText が不足しています",
      });
    }

    // 最新の生成ロジック呼び出し（1回目転院・2回目転院）
    const pdfResults: any[] = await generateForm6PDFs(form5InputText, form6InputText);

    if (!pdfResults || pdfResults.length === 0) {
      console.warn("⚠️ [API /form6] 転院先データなし、または生成結果0件");
      return res.status(400).json({
        error: "転院先データが存在しないか、PDFが生成されませんでした",
      });
    }

    const files = pdfResults.map((item: any) => ({
      filename: item.filename,
      base64: Buffer.isBuffer(item.buffer)
        ? item.buffer.toString("base64")
        : Buffer.from(item.buffer).toString("base64"),
      contentType: "application/pdf",
    }));

    console.log(`✅ [API /form6] 正常完了: ${files.length}件のPDFを出力しました`);
    return res.json({ success: true, files });
  } catch (error: any) {
    console.error("❌ [API /form6] 生成エラー:", error);
    return res.status(500).json({
      error: "様式6号のPDF生成に失敗しました",
      details: error.message,
    });
  }
});

export default router;
