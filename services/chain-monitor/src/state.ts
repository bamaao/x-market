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

export interface MonitorAlert {
  id: string;
  severity: "info" | "warn" | "critical";
  source: string;
  message: string;
  at: string;
  resolved: boolean;
}

export interface MonitorMetrics {
  events24h: Record<string, number>;
  poolsPaused: string[];
  slashRecords: number;
  zkVerificationsOpen: number;
  gasStationOk: boolean | null;
  keeperOk: boolean | null;
  gasBalanceLow: boolean | null;
  keeperBalanceLow: boolean | null;
}

export interface MonitorState {
  lastPollAt: string | null;
  errors: string[];
  alerts: MonitorAlert[];
  metrics: MonitorMetrics;
}

export function emptyState(): MonitorState {
  return {
    lastPollAt: null,
    errors: [],
    alerts: [],
    metrics: {
      events24h: {},
      poolsPaused: [],
      slashRecords: 0,
      zkVerificationsOpen: 0,
      gasStationOk: null,
      keeperOk: null,
      gasBalanceLow: null,
      keeperBalanceLow: null,
    },
  };
}
