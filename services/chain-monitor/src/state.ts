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
