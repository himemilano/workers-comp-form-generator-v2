import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import generateRouter from "./routes/generate";

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CORS 設定（フロントエンドからのクロスドメインリクエストを許可）
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 2. リクエストボディ解析の設定（大容量PDFデータ・Base64等の送受信に対応）
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 3. 静的ファイル（テンプレートPDFやフォント）へのアクセス用設定
app.use("/public", express.static(path.join(process.cwd(), "public")));

// 4. Render等のホスティングサービス用 ヘルスチェックエンドポイント
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("労災保険申請書 PDF生成 API サーバーは正常に稼働しています。");
});

// 5. API ルートの登録
app.use("/api", generateRouter);

// 6. 404 Not Found ハンドラー
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "指定された API エンドポイントが存在しません。" });
});

// 7. グローバルエラーハンドリングミドルウェア（サーバー停止の防止 & エラー応答）
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("❌ [Server Error] サーバー内部エラーが発生しました:", err);
  res.status(500).json({
    error: "サーバー内部でエラーが発生しました。",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 8. キャッチされなかった非同期例外のログ出力（RenderのLogsで原因特定を容易化）
process.on("uncaughtException", (err: Error) => {
  console.error("🚨 [CRITICAL] キャッチされなかった例外 (Uncaught Exception):", err);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("🚨 [CRITICAL] 未処理の Promise 拒否 (Unhandled Rejection):", reason);
});

// 9. サーバー起動
const server = app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`=================================`);
});

// 10. シグナル受信時の正常シャットダウン処理（Renderの再デプロイ時用）
process.on("SIGTERM", () => {
  console.log("⚠️ SIGTERM シグナルを受信しました。サーバーを正常に終了します...");
  server.close(() => {
    console.log("🛑 サーバー処理を終了しました。");
  });
});
