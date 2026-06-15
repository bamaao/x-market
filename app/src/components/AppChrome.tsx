// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="logo-mark" width={28} height={28} />
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
