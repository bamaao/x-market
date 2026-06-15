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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * P3.4 GeoBlock — 基于 CDN/边缘 `x-vercel-ip-country` 或自定义 header。
 * 设置 GEO_BLOCK_ENABLED=true 与 GEO_BLOCKED_COUNTRIES=US,CN,... 启用。
 */
export function middleware(request: NextRequest) {
  if (process.env.GEO_BLOCK_ENABLED !== "true") {
    return NextResponse.next();
  }

  const blocked = (process.env.GEO_BLOCKED_COUNTRIES ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (!blocked.length) return NextResponse.next();

  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-geo-country") ??
    "";

  if (country && blocked.includes(country.toUpperCase())) {
    if (request.nextUrl.pathname.startsWith("/blocked")) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/blocked";
    url.searchParams.set("country", country);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
