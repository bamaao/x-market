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

import type { NextConfig } from "next";

function backendProxyRewrites():
  | { source: string; destination: string }[]
  | undefined {
  const host = process.env.BACKEND_PROXY_HOST?.trim();
  if (!host) return undefined;

  const bare = host.replace(/^https?:\/\//, "").replace(/\/$/, "").split(":")[0];
  const scheme = process.env.BACKEND_PROXY_SCHEME?.trim() || "http";
  const origin = (port: number) => `${scheme}://${bare}:${port}`;

  return [
    { source: "/api/indexer/:path*", destination: `${origin(8800)}/:path*` },
    { source: "/api/pricing/:path*", destination: `${origin(8801)}/:path*` },
    { source: "/api/walrus/:path*", destination: `${origin(8791)}/:path*` },
  ];
}

const rewrites = backendProxyRewrites();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(rewrites ? { async rewrites() { return rewrites; } } : {}),
};

export default nextConfig;
