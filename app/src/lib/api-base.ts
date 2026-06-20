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

/**
 * API base URL helpers — supports direct URLs and Vercel same-origin proxy (/api/*).
 */

const PROXY_ROUTE_PORTS: Record<string, number> = {
  "/api/indexer": 8800,
  "/api/pricing": 8801,
  "/api/walrus": 8791,
};

export function normalizeApiBase(url: string | undefined): string {
  return url?.replace(/\/$/, "") ?? "";
}

export function isVercelProxyBase(base: string): boolean {
  return base.startsWith("/");
}

/** Join API base + path (path must start with /). */
export function resolveApiUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = normalizeApiBase(base);

  if (!normalizedBase) {
    return normalizedPath;
  }

  if (!isVercelProxyBase(normalizedBase)) {
    return `${normalizedBase}${normalizedPath}`;
  }

  // Browser: same-origin → Vercel rewrites → backend
  if (typeof window !== "undefined") {
    return `${normalizedBase}${normalizedPath}`;
  }

  // SSR / Route Handlers: hit backend directly (skip extra proxy hop)
  const direct = backendDirectOrigin(normalizedBase);
  if (direct) {
    return `${direct}${normalizedPath}`;
  }

  // Local dev fallback via Next dev server
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}${normalizedBase}${normalizedPath}`;
  }

  return `http://127.0.0.1:3000${normalizedBase}${normalizedPath}`;
}

function backendDirectOrigin(proxyBase: string): string | null {
  const host = process.env.BACKEND_PROXY_HOST?.trim();
  const port = PROXY_ROUTE_PORTS[proxyBase];
  if (!host || !port) return null;

  const bare = host.replace(/^https?:\/\//, "").replace(/\/$/, "").split(":")[0];
  const scheme = process.env.BACKEND_PROXY_SCHEME?.trim() || "http";
  return `${scheme}://${bare}:${port}`;
}

export function readBackendProxyHost(): string | undefined {
  return process.env.BACKEND_PROXY_HOST?.trim() || undefined;
}
