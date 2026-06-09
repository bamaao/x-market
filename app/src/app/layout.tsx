import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { SiteNav } from "@/components/SiteNav";
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
              <span className="logo-mark">X</span>
              X-Market <span>Sui</span>
            </a>
            <SiteNav />
            <div className="header-actions">
              <WalletButton />
            </div>
          </header>
          <main className="main">{children}</main>
          <footer className="footer">
            <div className="footer-links">
              <a href="/">市场</a>
              <a href="/prophet">Prophet</a>
              <a href="/oracle">Oracle</a>
              <a href="/leaderboard">排行榜</a>
            </div>
            <p>链上 PDF 预测市场 · Sui Testnet</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
