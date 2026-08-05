import express from "express";
import cors from "cors";
import generateRouter from "./routes/generate"; // 同一階層の routes フォルダを指定

const app = express();
const PORT = process.env.PORT || 3000;

// フロントエンドからのリクエストを許可
app.use(cors());
// リクエストボディの容量上限を50MBに拡大
app.use(express.json({ limit: "50mb" }));

// APIルートの登録
app.use("/api", generateRouter);

app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
