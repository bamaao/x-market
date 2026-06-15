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

import { useState } from "react";
import { resolveMarketImageUrl } from "@/lib/market-media";
import { useT } from "@/i18n/context";

type Variant = "card" | "hero" | "thumb";

type Props = {
  id?: string;
  slug?: string | null;
  imageUrl?: string | null;
  title: string;
  kind?: string;
  variant?: Variant;
  priority?: boolean;
};

const VARIANT_CLASS: Record<Variant, string> = {
  card: "market-cover market-cover--card",
  hero: "market-cover market-cover--hero",
  thumb: "market-cover market-cover--thumb",
};

export function MarketCover({
  id,
  slug,
  imageUrl,
  title,
  kind,
  variant = "card",
}: Props) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const src = resolveMarketImageUrl({ id, slug, imageUrl });
  const className = `${VARIANT_CLASS[variant]} market-cover--${kind ?? "default"}`;

  if (!src || failed) {
    return (
      <div className={className} aria-hidden>
        <div className="market-cover-fallback" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={t("markets.coverAlt", { title })}
        className="market-cover-img"
        loading={variant === "hero" ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
