"use client";

import { useI18n } from "./context";
import type { Locale } from "./types";
import type { SeedMarket } from "@/lib/markets";

export function localizeSeedMarket(
  market: SeedMarket,
  _locale: Locale,
  t: (key: string) => string,
): SeedMarket {
  const titleKey = `markets.seed.${market.id}.title`;
  const descKey = `markets.seed.${market.id}.description`;
  const title = t(titleKey);
  const description = t(descKey);
  return {
    ...market,
    title: title === titleKey ? market.title : title,
    description: description === descKey ? market.description : description,
  };
}

export function useLocalizedTagLabel() {
  const { t } = useI18n();
  return (slug: string) => {
    const key = `tags.${slug}`;
    const label = t(key);
    return label === key ? slug : label;
  };
}

export function useLocalizedSeedMarket() {
  const { locale, t } = useI18n();
  return (market: SeedMarket) => localizeSeedMarket(market, locale, t);
}
