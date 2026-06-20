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

import type { SeedMarket } from "./markets";

const STATUS_AUCTION = 0;
const STATUS_TRADING = 1;
const STATUS_SETTLED = 2;

/** List-card lifecycle label from Indexer / seed params (no RPC). */
export function marketListStatusKey(market: SeedMarket): string | null {
  const status = market.params.status;
  if (typeof status !== "number") return null;
  if (market.params.paused === 1) return "positions.poolStatus.paused";
  if (market.params.resolved === 1 || status === STATUS_SETTLED) {
    return "positions.poolStatus.settled";
  }
  if (status === STATUS_AUCTION) return "positions.poolStatus.auction";
  if (status === STATUS_TRADING) return "positions.poolStatus.trading";
  return null;
}

export function marketListStatusClass(market: SeedMarket): string {
  const status = market.params.status;
  if (typeof status !== "number") return "market-status-badge";
  if (market.params.paused === 1) return "market-status-badge market-status-paused";
  if (market.params.resolved === 1 || status === STATUS_SETTLED) {
    return "market-status-badge market-status-settled";
  }
  if (status === STATUS_AUCTION) return "market-status-badge market-status-auction";
  if (status === STATUS_TRADING) return "market-status-badge market-status-trading";
  return "market-status-badge";
}
