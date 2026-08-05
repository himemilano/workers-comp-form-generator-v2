import React, { useState } from "react";

export const Form5DirectApp: React.FC = () => {
  const [rawText, setRawText] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleGeneratePdf = async () => {
    if (!rawText.trim()) {
      alert("返送テキストを貼り付けてください。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/form5/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      if (!response.ok) {
        throw new Error("PDFの生成に失敗しました");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-slate-100 min-h-screen">
      <header className="mb-6 border-b border-slate-300 pb-4">
        <h1 className="text-2xl font-bold text-slate-800">労災申請書（様式第5号）一発発行システム</h1>
        <p className="text-sm text-slate-600 mt-1">
          LINEやメールで送られてきたテキストをそのまま貼り付けてボタンを押してください。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側：入力エリア */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              1. 返信テキストを貼り付け
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="ここに返信メッセージをそのまま貼り付けます..."
              rows={20}
              className="w-full p-3 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleGeneratePdf}
              disabled={loading}
              className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow flex justify-center items-center gap-2"
            >
              {loading ? "📄 PDF作成中..." : "🚀 2. PDFを作成して表示"}
            </button>
          </div>
        </div>

        {/* 右側：PDFプレビュー・印刷エリア */}
        <div className="lg:col-span-7">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-slate-700">3. 完成PDFプレビュー</span>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download="労災様式第5号.pdf"
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition"
                >
                  📥 PDFを保存
                </a>
              )}
            </div>

            <div className="flex-1 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center min-h-[650px]">
              {pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-full min-h-[650px] border-none" title="PDF Preview" />
              ) : (
                <div className="text-center text-slate-400">
                  <p className="text-4xl mb-2">📄</p>
                  <p className="text-sm">左側で「PDFを作成して表示」を押すと<br />ここに印刷可能なPDFが表示されます</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Form5DirectApp;