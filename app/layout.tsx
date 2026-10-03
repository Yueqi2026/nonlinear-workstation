import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "非线性生物物理闭环科研工作站",
  description: "面向数据—模型—实验迭代的可编辑科研工作站。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
