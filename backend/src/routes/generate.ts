import { Router, Request, Response } from "express";
import { generateForm5PDFs, generateForm6PDFs } from "../pdf/generateForm";

const router = Router();

/**
 * 様式第5号 生成API
 * POST /api/pdf/form5
 */
router.post("/pdf/form5", async (req: Request, res: Response) => {
  try {
    const { inputText } = req.body;
    if (!inputText) {
      return res.status(400).json({ error: "入力テキスト(inputText)が空です" });
    }

    const pdfResults = await generateForm5PDFs(inputText);
    if (!pdfResults || pdfResults.length === 0) {
      return res.status(500).json({ error: "様式5号のPDF生成結果が0件です" });
    }

    const files = pdfResults.map((item) => ({
      filename: item.filename,
      base64: Buffer.isBuffer(item.buffer)
        ? item.buffer.toString("base64")
        : Buffer.from(item.buffer).toString("base64"),
      contentType: "application/pdf",
    }));

    return res.json({ success: true, files });
  } catch (error: any) {
    console.error("❌ [API /pdf/form5] 生成エラー:", error);
    return res.status(500).json({
      error: "様式5号のPDF生成に失敗しました",
      details: error.message,
    });
  }
});

/**
 * 様式第6号 生成API
 * POST /api/pdf/form6
 */
router.post("/pdf/form6", async (req: Request, res: Response) => {
  try {
    const { form5InputText, form6InputText } = req.body;
    if (!form5InputText || !form6InputText) {
      return res.status(400).json({
        error: "form5InputText または form6InputText が不足しています",
      });
    }

    const pdfResults = await generateForm6PDFs(form5InputText, form6InputText);
    if (!pdfResults || pdfResults.length === 0) {
      return res.status(400).json({
        error: "転院先データが存在しないか、PDFが生成されませんでした",
      });
    }

    const files = pdfResults.map((item) => ({
      filename: item.filename,
      base64: Buffer.isBuffer(item.buffer)
        ? item.buffer.toString("base64")
        : Buffer.from(item.buffer).toString("base64"),
      contentType: "application/pdf",
    }));

    return res.json({ success: true, files });
  } catch (error: any) {
    console.error("❌ [API /pdf/form6] 生成エラー:", error);
    return res.status(500).json({
      error: "様式6号のPDF生成に失敗しました",
      details: error.message,
    });
  }
});

export default router;
