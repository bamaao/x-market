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

import {
  fetchIndexerMarkets,
  indexerEnabled,
  type IndexerMarket,
} from "./indexer";
import {
  indexerMarketToSeed,
  SEED_MARKETS,
  type SeedMarket,
} from "./markets";

const USER_MARKETS_KEY = "xmarket_user_markets_v1";

export function findSeedMarketById(id: string): SeedMarket | undefined {
  return SEED_MARKETS.find((m) => m.id === id);
}

export function loadUserMarkets(): SeedMarket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_MARKETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SeedMarket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserMarket(market: SeedMarket): void {
  if (typeof window === "undefined") return;
  const existing = loadUserMarkets().filter((m) => m.id !== market.id);
  existing.unshift(market);
  localStorage.setItem(USER_MARKETS_KEY, JSON.stringify(existing.slice(0, 50)));
}

export function mergeMarkets(
  seed: SeedMarket[],
  user: SeedMarket[],
  indexer: SeedMarket[],
): SeedMarket[] {
  const byId = new Map<string, SeedMarket>();
  for (const m of seed) byId.set(m.id, m);
  for (const m of indexer) byId.set(m.id, m);
  for (const m of user) byId.set(m.id, m);
  return [...byId.values()];
}

export async function resolveMarketById(id: string): Promise<SeedMarket | null> {
  const seed = findSeedMarketById(id);
  if (seed) return seed;

  const user = loadUserMarkets().find((m) => m.id === id || m.params.poolId === id);
  if (user) return user;

  if (indexerEnabled()) {
    const { markets: rows } = await fetchIndexerMarkets();
    const hit = rows.find(
      (m) => m.slug === id || m.pool_id === id,
    );
    if (hit) return indexerMarketToSeed(hit);
  }

  return null;
}

export function indexerRowsToSeeds(rows: IndexerMarket[]): SeedMarket[] {
  return rows.map(indexerMarketToSeed);
}
