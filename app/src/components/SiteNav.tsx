"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "市场" },
  { href: "/markets/create", label: "创建市场" },
  { href: "/positions", label: "持仓" },
  { href: "/lp", label: "LP" },
  { href: "/margin", label: "保证金" },
  { href: "/oracle", label: "Oracle" },
  { href: "/prophet", label: "Prophet" },
  { href: "/leaderboard", label: "排行榜" },
  { href: "/following", label: "我的关注" },
  { href: "/roi", label: "跟单 ROI" },
  { href: "/metrics", label: "GMV" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="主导航">
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={isActive(pathname, href) ? "active" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
