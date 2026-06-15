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
