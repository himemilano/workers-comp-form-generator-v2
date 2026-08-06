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
    if (!inputText) {
      return res.status(400).json({ error: "入力テキストが空です" });
    }

    // 最新の生成ロジック呼び出し（病院用・薬局用）
    const pdfResults = await generateForm5PDFs(inputText);

    const files = pdfResults.map((item: any) => ({
      filename: item.filename,
      base64: item.buffer.toString("base64"),
      contentType: "application/pdf",
    }));

    return res.json({ success: true, files });
  } catch (error: any) {
    console.error("Form5 Generation Error:", error);
    return res.status(500).json({ error: "PDF生成に失敗しました", details: error.message });
  }
});

/**
 * 様式第6号 生成API
 * POST /api/form6
 */
router.post("/form6", async (req: Request, res: Response) => {
  try {
    const { form5InputText, form6InputText } = req.body;
    if (!form5InputText || !form6InputText) {
      return res.status(400).json({ error: "Form5またはForm6の入力テキストが不足しています" });
    }

    // 最新の生成ロジック呼び出し（1回目転院・2回目転院）
    const pdfResults = await generateForm6PDFs(form5InputText, form6InputText);

    const files = pdfResults.map((item: any) => ({
      filename: item.filename,
      base64: item.buffer.toString("base64"),
      contentType: "application/pdf",
    }));

    return res.json({ success: true, files });
  } catch (error: any) {
    console.error("Form6 Generation Error:", error);
    return res.status(500).json({ error: "PDF生成に失敗しました", details: error.message });
  }
});

export default router;