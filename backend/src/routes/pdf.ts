import { Router, Request, Response } from "express";
import { generateForm5PDFs, generateForm6PDFs } from "../pdf/generateForm";

const router = Router();

/**
 * 様式第5号 生成API
 * POST /api/pdf/form5
 * Body: { inputText: "..." }
 */
router.post("/form5", async (req: Request, res: Response) => {
  try {
    const { inputText } = req.body;
    if (!inputText) {
      return res.status(400).json({ error: "入力テキストが空です" });
    }

    // PDF生成処理の呼び出し（病院用・薬局用の最大2枚）
    const pdfResults = await generateForm5PDFs(inputText);

    // フロントエンドで扱いやすいよう Base64 形式に変換して返却
    const files = pdfResults.map((item) => ({
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
 * POST /api/pdf/form6
 * Body: { form5InputText: "...", form6InputText: "..." }
 */
router.post("/form6", async (req: Request, res: Response) => {
  try {
    const { form5InputText, form6InputText } = req.body;
    if (!form5InputText || !form6InputText) {
      return res.status(400).json({ error: "Form5またはForm6の入力テキストが不足しています" });
    }

    // PDF生成処理の呼び出し（1回目転院・2回目転院の最大2枚）
    const pdfResults = await generateForm6PDFs(form5InputText, form6InputText);

    if (!pdfResults || pdfResults.length === 0) {
      return res.status(400).json({ error: "転院先データが存在しないため、PDFが生成されませんでした" });
    }

    const files = pdfResults.map((item) => ({
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