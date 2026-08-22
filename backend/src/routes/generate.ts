import { Router, Request, Response, RequestHandler } from "express";
import { generateForm5PDFs, generateForm6PDFs } from "../pdf/generateForm";

const router = Router();

/**
 * Form 5 PDF生成処理ハンドラー
 */
const handleForm5: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { inputText } = req.body;
    if (!inputText) {
      res.status(400).json({ error: "入力データ (inputText) が不足しています。" });
      return;
    }

    const pdfResults = await generateForm5PDFs(inputText);

    // フロントエンドが期待する { filename, base64 } 形式に変換
    const files = pdfResults.map((result) => ({
      filename: result.filename,
      base64: Buffer.from(result.buffer).toString("base64"),
    }));

    res.status(200).json({
      success: true,
      files,
    });
  } catch (error: any) {
    console.error("❌ [Form5 Generation Error]:", error);
    res.status(500).json({
      error: "Form5のPDF生成処理に失敗しました。",
      message: error.message,
    });
  }
};

/**
 * Form 6 PDF生成処理ハンドラー
 */
const handleForm6: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { form5InputText, form6InputText } = req.body;
    if (!form5InputText || !form6InputText) {
      res.status(400).json({
        error: "form5InputText および form6InputText の両方が必要です。",
      });
      return;
    }

    const pdfResults = await generateForm6PDFs(form5InputText, form6InputText);

    // フロントエンドが期待する { filename, base64 } 形式に変換
    const files = pdfResults.map((result) => ({
      filename: result.filename,
      base64: Buffer.from(result.buffer).toString("base64"),
    }));

    res.status(200).json({
      success: true,
      files,
    });
  } catch (error: any) {
    console.error("❌ [Form6 Generation Error]:", error);
    res.status(500).json({
      error: "Form6のPDF生成処理に失敗しました。",
      message: error.message,
    });
  }
};

// --- ルーティング登録 ---
// フロントエンドの呼び出しパス (/api/pdf/form5) および代替パスに対応
router.post("/pdf/form5", handleForm5);
router.post("/form5", handleForm5);
router.post("/generate/form5", handleForm5);

router.post("/pdf/form6", handleForm6);
router.post("/form6", handleForm6);
router.post("/generate/form6", handleForm6);

export default router;
