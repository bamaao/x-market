"use client";

import { useState } from "react";
import { resolveMarketImageUrl } from "@/lib/market-media";

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
        alt={`${title} 封面`}
        className="market-cover-img"
        loading={variant === "hero" ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
