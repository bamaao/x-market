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
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/context";

const NAV_HREFS = [
  "/",
  "/markets/create",
  "/positions",
  "/lp",
  "/oracle",
  "/prophet",
  "/leaderboard",
  "/following",
  "/roi",
  "/metrics",
] as const;

const NAV_KEYS = [
  "nav.markets",
  "nav.createMarket",
  "nav.positions",
  "nav.lp",
  "nav.oracle",
  "nav.prophet",
  "nav.leaderboard",
  "nav.following",
  "nav.roi",
  "nav.metrics",
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="site-nav" aria-label={t("nav.aria")}>
      {NAV_HREFS.map((href, index) => (
        <Link
          key={href}
          href={href}
          className={isActive(pathname, href) ? "active" : undefined}
        >
          {t(NAV_KEYS[index])}
        </Link>
      ))}
    </nav>
  );
}
