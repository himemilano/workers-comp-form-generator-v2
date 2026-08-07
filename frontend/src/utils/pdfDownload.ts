/**
 * Base64形式のPDFデータをブラウザでダウンロードさせる関数
 */
export function downloadPdfFromBase64(base64Data: string, filename: string): void {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 複数のBase64形式PDFデータを順次ダウンロードさせる関数
 */
export function downloadMultiplePdfsFromBase64(files: { filename: string; base64: string }[]): void {
  files.forEach((file) => {
    downloadPdfFromBase64(file.base64, file.filename);
  });
}

/**
 * 様式第6号のPDF生成APIを呼び出し、取得した全PDFを連続ダウンロードする関数
 */
export async function generateAndDownloadForm6(form5InputText: string, form6InputText: string): Promise<void> {
  try {
    const response = await fetch("/api/pdf/form6", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ form5InputText, form6InputText }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "PDF生成に失敗しました。");
    }

    if (data.files && Array.isArray(data.files)) {
      downloadMultiplePdfsFromBase64(data.files);
    } else {
      throw new Error("生成されたPDFデータが正しく受け取れませんでした。");
    }
  } catch (error) {
    console.error("PDF生成・ダウンロードエラー:", error);
    alert(error instanceof Error ? error.message : "予期せぬエラーが発生しました。");
  }
}