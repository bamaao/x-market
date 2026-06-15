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

import { useI18n } from "./context";
import { localizeSeedMarket } from "./market-localization";
import type { SeedMarket } from "@/lib/markets";

export { localizeSeedMarket } from "./market-localization";

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
