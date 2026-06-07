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
