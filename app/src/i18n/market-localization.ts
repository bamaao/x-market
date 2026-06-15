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
