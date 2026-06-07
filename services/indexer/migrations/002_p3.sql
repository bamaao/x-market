-- P3.3 Seal 到期明文缓存
CREATE TABLE IF NOT EXISTS seal_plaintext_cache (
  prophecy_id TEXT PRIMARY KEY REFERENCES prophecies(prophecy_id) ON DELETE CASCADE,
  pool_id TEXT NOT NULL,
  blob_id TEXT NOT NULL,
  plaintext_json JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lock_time BIGINT NOT NULL,
  source TEXT NOT NULL DEFAULT 'walrus'
);

CREATE INDEX IF NOT EXISTS idx_seal_cache_pool ON seal_plaintext_cache(pool_id);

-- P3.1 订阅者 ROI 汇总物化（按买家周期快照）
CREATE TABLE IF NOT EXISTS buyer_roi_summary (
  buyer TEXT PRIMARY KEY,
  total_unlock_cost BIGINT NOT NULL DEFAULT 0,
  total_positions INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  cheats INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  aggregate_roi_bps INTEGER,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
