import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'リアルタイム文字起こし with マーメイド図生成',
  description: 'リアルタイム音声認識と自動マーメイド図生成システム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
