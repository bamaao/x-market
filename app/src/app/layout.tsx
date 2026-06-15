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

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/Providers";
import { AppChrome } from "@/components/AppChrome";
import { localeFromCookieValue } from "@/i18n/core";
import { LOCALE_COOKIE } from "@/i18n/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "x-market",
  description: "PDF prediction markets — object positions, parallel pricing",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    title: "x-market",
  },
};

export const viewport: Viewport = {
  themeColor: "#E85D04",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialLocale = localeFromCookieValue(
    cookieStore.get(LOCALE_COOKIE)?.value,
  );

  return (
    <html lang={initialLocale === "zh" ? "zh-CN" : "en"} suppressHydrationWarning>
      <body>
        <Providers initialLocale={initialLocale}>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
