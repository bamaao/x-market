"use client";

import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { WalletButton } from "@/components/WalletButton";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useI18n } from "@/i18n/context";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <>
      <header className="header">
        <Link href="/" className="logo">
          <span className="logo-mark">X</span>
          X-Market <span>Sui</span>
        </Link>
        <SiteNav />
        <div className="header-actions">
          <LocaleSwitcher />
          <WalletButton />
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <div className="footer-links">
          <Link href="/">{t("nav.markets")}</Link>
          <Link href="/prophet">{t("nav.prophet")}</Link>
          <Link href="/oracle">{t("nav.oracle")}</Link>
          <Link href="/leaderboard">{t("nav.leaderboard")}</Link>
        </div>
        <p>{t("common.footerTagline")}</p>
      </footer>
    </>
  );
}
