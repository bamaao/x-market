import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { WalletButton } from "@/components/WalletButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "X-Market on Sui",
  description: "PDF 预测市场 — 对象化头寸，并行定价",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <header className="header">
            <a href="/" className="logo">
              X-Market <span>Sui</span>
            </a>
            <nav>
              <a href="/">市场</a>
              <a href="/positions">持仓</a>
              <a href="/lp">LP</a>
              <a href="/margin">保证金</a>
              <a href="/oracle">Oracle</a>
              <a href="/prophet">Prophet</a>
            </nav>
            <WalletButton />
          </header>
          <main className="main">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
