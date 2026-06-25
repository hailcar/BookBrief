import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BookBrief",
  description:
    "本地优先的 EPUB/PDF AI 阅读助手：EPUB 支持总结、批注和翻译，PDF 支持原版阅读、搜索和书签",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hans"
      className={`${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}
    >
      <body className="flex h-dvh min-h-0 flex-col overflow-hidden">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
