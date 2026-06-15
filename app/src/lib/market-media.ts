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

import { INDEXER_URL } from "./indexer";
import { resolveIpfsRef } from "./ipfs";

export const MARKET_COVER_BY_ID: Record<string, string> = {
  "poisson-goals": "/markets/poisson-goals.svg",
  "dirichlet-wdl": "/markets/dirichlet-wdl.svg",
  "normal-cpi": "/markets/normal-cpi.svg",
  "beta-vote": "/markets/beta-vote.svg",
};

export function resolveMarketImageUrl(input: {
  id?: string;
  slug?: string | null;
  imageUrl?: string | null;
  poolId?: string;
}): string | undefined {
  const raw = input.imageUrl?.trim();
  if (raw) {
    const ipfsUrl = resolveIpfsRef(raw);
    if (ipfsUrl) return ipfsUrl;
    if (raw.startsWith("/v1/covers/")) {
      if (!INDEXER_URL) return undefined;
      return `${INDEXER_URL}${raw}`;
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }
    if (raw.startsWith("/")) {
      return raw;
    }
  }
  if (input.id && MARKET_COVER_BY_ID[input.id]) {
    return MARKET_COVER_BY_ID[input.id];
  }
  if (input.slug && MARKET_COVER_BY_ID[input.slug]) {
    return MARKET_COVER_BY_ID[input.slug];
  }
  return undefined;
}

export function coverForSeedKey(key: string): string | undefined {
  const map: Record<string, string> = {
    poisson_goals: MARKET_COVER_BY_ID["poisson-goals"],
    dirichlet_wdl: MARKET_COVER_BY_ID["dirichlet-wdl"],
    normal_cpi: MARKET_COVER_BY_ID["normal-cpi"],
    beta_vote: MARKET_COVER_BY_ID["beta-vote"],
  };
  return map[key];
}
