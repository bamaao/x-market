-- Copyright (c) 2026 zouyc zouyccq@gmail.com.
-- All rights reserved.
--
-- Licensed under the Business Source License 1.1 (BSL 1.1).
-- You may not use this file except in compliance with the License.
--
-- Change Date: 2031-01-01
-- On the Change Date, or the fourth anniversary of the first publicly available
-- distribution of the code under the BSL, whichever comes first, the code
-- automatically becomes available under the Apache License 2.0.

-- P4.2 EventRoot 索引
CREATE TABLE IF NOT EXISTS event_roots (
  event_root_id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  feed_id TEXT,
  event_id TEXT NOT NULL,
  lock_time BIGINT NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  oracle_feed_id TEXT,
  prophet_registry_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_roots_pool ON event_roots(pool_id);

-- P4.4 Prophet GMV 日聚合
CREATE TABLE IF NOT EXISTS prophet_gmv_daily (
  day DATE PRIMARY KEY,
  unlock_gmv BIGINT NOT NULL DEFAULT 0,
  unlock_count INTEGER NOT NULL DEFAULT 0,
  prophecies_audited INTEGER NOT NULL DEFAULT 0,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
