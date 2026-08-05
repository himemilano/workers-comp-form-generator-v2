export const metadata = {
  title: "労災様式PDF 自動発行システム",
  description: "労災申請PDF作成ツール",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}