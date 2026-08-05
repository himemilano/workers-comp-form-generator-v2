"use client";

import { useState } from "react";
import { downloadPdfFromBase64 } from "../utils/pdfDownload";

export default function LabourFormPage() {
  const [form5Text, setForm5Text] = useState("");
  const [form6Text, setForm6Text] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // 本番環境（process.env）またはローカル環境のAPI接続先を取得
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

  // 様式第5号（病院用・薬局用）の生成処理
  const handleGenerateForm5 = async () => {
    if (!form5Text.trim()) {
      alert("様式第5号の入力テキストを貼り付けてください。");
      return;
    }

    setLoading(true);
    setMessage({ type: "info", text: "様式第5号のPDFを生成・一括ダウンロード中..." });

    try {
      const response = await fetch(`${API_BASE_URL}/form5`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: form5Text }),
      });

      const data = await response.json();

      if (data.success && data.files) {
        data.files.forEach((file: { base64: string; filename: string }) => {
          downloadPdfFromBase64(file.base64, file.filename);
        });
        setMessage({
          type: "success",
          text: `【処理完了】様式第5号（${data.files.length}枚）のPDFを出力しました。`,
        });
      } else {
        setMessage({ type: "error", text: `エラー: ${data.error || "生成に失敗しました"}` });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: "通信エラーが発生しました。バックエンドサーバーが起動しているか確認してください。",
      });
    } finally {
      setLoading(false);
    }
  };

  // 様式第6号（1回目・2回目転院）の生成処理
  const handleGenerateForm6 = async () => {
    if (!form5Text.trim() || !form6Text.trim()) {
      alert("様式第6号の生成には、「様式第5号」と「様式第6号」の両方のテキストデータが必要です。");
      return;
    }

    setLoading(true);
    setMessage({ type: "info", text: "様式第6号のPDF（転院リレー）を生成中..." });

    try {
      const response = await fetch(`${API_BASE_URL}/form6`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form5InputText: form5Text,
          form6InputText: form6Text,
        }),
      });

      const data = await response.json();

      if (data.success && data.files) {
        data.files.forEach((file: { base64: string; filename: string }) => {
          downloadPdfFromBase64(file.base64, file.filename);
        });
        setMessage({
          type: "success",
          text: `【処理完了】様式第6号（${data.files.length}枚）のPDFを出力しました。`,
        });
      } else {
        setMessage({ type: "error", text: `エラー: ${data.error || "生成に失敗しました"}` });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: "通信エラーが発生しました。バックエンドサーバーが起動しているか確認してください。",
      });
    } finally {
      setLoading(false);
    }
  };

  // フォームクリア（リセット）
  const handleClearAll = () => {
    if (confirm("入力欄をすべてクリアしますか？")) {
      setForm5Text("");
      setForm6Text("");
      setMessage(null);
    }
  };

  return (
    <main style={{ padding: "30px", maxWidth: "960px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <header style={{ borderBottom: "2px solid #0070f3", paddingBottom: "15px", marginBottom: "25px" }}>
        <h1 style={{ fontSize: "24px", color: "#333", margin: 0 }}>労災様式PDF 自動発行システム</h1>
        <p style={{ color: "#666", fontSize: "14px", marginTop: "5px" }}>
          被災者から回収したテキストデータを貼り付けるだけで、様式第5号（病院/薬局）および様式第6号（転院届）を自動一括生成します。
        </p>
      </header>

      {/* ステータス通知エリア */}
      {message && (
        <div
          style={{
            padding: "12px 20px",
            borderRadius: "6px",
            marginBottom: "20px",
            fontWeight: "bold",
            backgroundColor:
              message.type === "success" ? "#d4edda" : message.type === "error" ? "#f8d7da" : "#cce5ff",
            color: message.type === "success" ? "#155724" : message.type === "error" ? "#721c24" : "#004085",
            border: `1px solid ${
              message.type === "success" ? "#c3e6cb" : message.type === "error" ? "#f5c6cb" : "#b8daff"
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* 共通アクションエリア */}
      <div style={{ textAlign: "right", marginBottom: "15px" }}>
        <button
          onClick={handleClearAll}
          style={{
            padding: "6px 14px",
            backgroundColor: "#6c757d",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          入力欄をすべて消去
        </button>
      </div>

      {/* 1. 様式第5号 エリア */}
      <section
        style={{
          marginBottom: "30px",
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          backgroundColor: "#fafafa",
        }}
      >
        <h2 style={{ fontSize: "18px", marginTop: 0, color: "#0070f3" }}>
          1. 様式第5号（初期請求用データ貼り付け）
        </h2>
        <textarea
          rows={10}
          style={{
            width: "100%",
            padding: "12px",
            boxSizing: "border-box",
            fontSize: "13px",
            fontFamily: "monospace",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
          placeholder="【労災請求書（様式第5号）作成用データご入力のお願い】の返信テキストを貼り付けてください..."
          value={form5Text}
          onChange={(e) => setForm5Text(e.target.value)}
        />
        <button
          onClick={handleGenerateForm5}
          disabled={loading}
          style={{
            marginTop: "12px",
            padding: "12px 24px",
            backgroundColor: loading ? "#ccc" : "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          様式第5号 PDF一括出力（病院用 ＋ 薬局用）
        </button>
      </section>

      {/* 2. 様式第6号 エリア */}
      <section
        style={{
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          backgroundColor: "#fafafa",
        }}
      >
        <h2 style={{ fontSize: "18px", marginTop: 0, color: "#28a745" }}>
          2. 様式第6号（転院届追加入力データ貼り付け）
        </h2>
        <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px", marginBottom: "10px" }}>
          ※上の「様式第5号」のデータから本人情報等を自動で引き継いで生成します。
        </p>
        <textarea
          rows={8}
          style={{
            width: "100%",
            padding: "12px",
            boxSizing: "border-box",
            fontSize: "13px",
            fontFamily: "monospace",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
          placeholder="【労災指定病院等変更届（様式第6号）追加入力のお願い】の返信テキストを貼り付けてください..."
          value={form6Text}
          onChange={(e) => setForm6Text(e.target.value)}
        />
        <button
          onClick={handleGenerateForm6}
          disabled={loading}
          style={{
            marginTop: "12px",
            padding: "12px 24px",
            backgroundColor: loading ? "#ccc" : "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          様式第6号 PDF一括出力（1回目転院 ＋ 2回目転院）
        </button>
      </section>
    </main>
  );
}