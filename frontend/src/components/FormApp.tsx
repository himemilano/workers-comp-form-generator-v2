import React, { useState } from "react";
// schemas/index.json を直接インポートして使用
import formsData from "../../../schemas/index.json";

// index.json の型定義
interface FormOption {
  id: string;
  formNumber: string;
  name: string;
  template: string;
  schema: string;
  pages: number;
}

export const FormApp: React.FC = () => {
  const formsList: FormOption[] = formsData.forms;

  // 選択中の様式ID (初期値: form5)
  const [selectedForm, setSelectedForm] = useState<string>("form5");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // テスト用共通入力データ
  const [formData, setFormData] = useState({
    worker_name: "厚生労働省 太郎",
    Company_Name: "株式会社 労務コーポレーション",
    zip_first: "100",
    zip_last: "0001",
    claimant_tel_num: "2222",
  });

  // 現在選択されている様式の詳細情報
  const currentFormInfo = formsList.find((f) => f.id === selectedForm);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`http://localhost:3000/api/generate-pdf/${selectedForm}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        alert(`[${selectedForm}] のPDF生成に失敗しました。`);
      }
    } catch (error) {
      console.error(error);
      alert("通信エラーが発生しました。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>労災保険給付請求書 作成システム</h2>
      
      {/* 正式名称入りのドロップダウン */}
      <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontWeight: "bold", fontSize: "14px" }}>
          作成する申請書（様式）を選択:
        </label>
        <select
          value={selectedForm}
          onChange={(e) => {
            setSelectedForm(e.target.value);
            setPdfUrl(null); // 切り替え時にプレビュー初期化
          }}
          style={{ 
            padding: "10px", 
            fontSize: "14px", 
            borderRadius: "6px", 
            border: "1px solid #ccc",
            maxWidth: "800px"
          }}
        >
          {formsList.map((form) => (
            <option key={form.id} value={form.id}>
              【様式第{form.formNumber}号】{form.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: "20px" }}>
        {/* 左側：入力フォーム */}
        <div style={{ width: "400px", border: "1px solid #ccc", padding: "15px", borderRadius: "8px", height: "fit-content" }}>
          <h3 style={{ marginTop: 0, fontSize: "16px" }}>
            {currentFormInfo ? `様式第${currentFormInfo.formNumber}号` : selectedForm} 入力項目
          </h3>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: "15px" }}>
            {currentFormInfo?.name}
          </p>
          
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold" }}>労働者氏名</label>
            <input 
              name="worker_name" 
              value={formData.worker_name} 
              onChange={handleInputChange} 
              style={{ width: "100%", padding: "6px", boxSizing: "border-box" }} 
            />
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold" }}>事業場名称 (Company_Name)</label>
            <input 
              name="Company_Name" 
              value={formData.Company_Name} 
              onChange={handleInputChange} 
              style={{ width: "100%", padding: "6px", boxSizing: "border-box" }} 
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold" }}>郵便番号 (前)</label>
              <input 
                name="zip_first" 
                value={formData.zip_first} 
                onChange={handleInputChange} 
                maxLength={3} 
                style={{ width: "60px", padding: "6px" }} 
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold" }}>郵便番号 (後)</label>
              <input 
                name="zip_last" 
                value={formData.zip_last} 
                onChange={handleInputChange} 
                maxLength={4} 
                style={{ width: "80px", padding: "6px" }} 
              />
            </div>
          </div>

          <button 
            onClick={handleGeneratePdf} 
            disabled={isGenerating}
            style={{ 
              width: "100%", 
              padding: "12px", 
              backgroundColor: "#0070f3", 
              color: "#fff", 
              border: "none", 
              borderRadius: "4px", 
              cursor: "pointer",
              fontWeight: "bold" 
            }}
          >
            {isGenerating ? "PDF生成中..." : "📄 PDFを生成する"}
          </button>
        </div>

        {/* 右側：プレビューエリア */}
        <div style={{ flex: 1, border: "1px solid #ccc", minHeight: "700px", borderRadius: "8px", overflow: "hidden", backgroundColor: "#f9f9f9" }}>
          {pdfUrl ? (
            <iframe src={pdfUrl} style={{ width: "100%", height: "100%", border: "none" }} title="PDF Preview" />
          ) : (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#888" }}>
              <p style={{ fontSize: "18px", margin: "0 0 8px 0" }}>📄 プレビュー表示エリア</p>
              <p style={{ fontSize: "13px" }}>上部で様式を選択し、左側のフォームを入力して「PDFを生成する」を押してください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};