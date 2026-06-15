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

CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  stream TEXT PRIMARY KEY,
  cursor_json TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS markets (
  pool_id TEXT PRIMARY KEY,
  slug TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  package_id TEXT NOT NULL,
  authority TEXT,
  status INTEGER NOT NULL DEFAULT 0,
  lambda_tenths INTEGER,
  mu_tenths INTEGER,
  sigma_tenths INTEGER,
  mu_units BIGINT,
  sigma_units BIGINT,
  dirichlet_alphas JSONB,
  fee_bps INTEGER NOT NULL DEFAULT 0,
  maturity_ts BIGINT NOT NULL,
  resolution_window_ts BIGINT,
  created_ts BIGINT,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_value BIGINT,
  event_root_id TEXT,
  feed_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_kind ON markets(kind);
CREATE INDEX IF NOT EXISTS idx_markets_maturity ON markets(maturity_ts);

CREATE TABLE IF NOT EXISTS feeds (
  feed_id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES markets(pool_id) ON DELETE CASCADE,
  identifier_hex TEXT,
  identifier_text TEXT,
  event_ts BIGINT NOT NULL,
  liveness_secs BIGINT NOT NULL,
  bond_required BIGINT NOT NULL,
  feed_status INTEGER NOT NULL DEFAULT 0,
  finalized_value BIGINT,
  active_assertion_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feeds_pool ON feeds(pool_id);

CREATE TABLE IF NOT EXISTS prophecies (
  prophecy_id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  prophet TEXT NOT NULL,
  lock_time BIGINT NOT NULL,
  unlock_price BIGINT NOT NULL DEFAULT 0,
  predicted_value BIGINT,
  status INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_count INTEGER NOT NULL DEFAULT 0,
  blob_id TEXT,
  seal_id_hex TEXT,
  plaintext_hash_hex TEXT,
  committed_at TIMESTAMPTZ,
  tx_digest TEXT,
  event_seq BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prophecies_pool ON prophecies(pool_id);
CREATE INDEX IF NOT EXISTS idx_prophecies_prophet ON prophecies(prophet);
CREATE INDEX IF NOT EXISTS idx_prophecies_status ON prophecies(status);

CREATE TABLE IF NOT EXISTS prophecy_unlocks (
  id SERIAL PRIMARY KEY,
  prophecy_id TEXT NOT NULL REFERENCES prophecies(prophecy_id) ON DELETE CASCADE,
  buyer TEXT NOT NULL,
  unlock_price BIGINT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prophecy_id, buyer)
);

CREATE TABLE IF NOT EXISTS prophet_stats (
  prophet TEXT PRIMARY KEY,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  cheats INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  total_audited INTEGER NOT NULL DEFAULT 0,
  total_unlock_revenue BIGINT NOT NULL DEFAULT 0,
  score_bps INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  paid_unlock_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prophet_stats_rank ON prophet_stats(rank);
CREATE INDEX IF NOT EXISTS idx_prophet_stats_score ON prophet_stats(score_bps DESC);

CREATE TABLE IF NOT EXISTS prophet_stats_history (
  id SERIAL PRIMARY KEY,
  prophet TEXT NOT NULL,
  score_bps INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prophet_stats_history_prophet ON prophet_stats_history(prophet, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS pool_snapshots (
  id SERIAL PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES markets(pool_id) ON DELETE CASCADE,
  vault_usdc BIGINT NOT NULL,
  collateral_usdc BIGINT NOT NULL,
  lp_shares BIGINT NOT NULL,
  fee_bps INTEGER NOT NULL,
  fee_multiplier_bps INTEGER NOT NULL,
  sigma_tenths INTEGER,
  sigma_virtual_tenths INTEGER,
  concentration_virtual INTEGER,
  lambda_tenths INTEGER,
  mu_tenths INTEGER,
  paused BOOLEAN NOT NULL,
  resolved BOOLEAN NOT NULL,
  liability_sum BIGINT NOT NULL DEFAULT 0,
  snapshot_ts BIGINT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_snapshots_pool_ts ON pool_snapshots(pool_id, snapshot_ts DESC);

CREATE TABLE IF NOT EXISTS iv_history (
  id SERIAL PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES markets(pool_id) ON DELETE CASCADE,
  iv_tenths INTEGER NOT NULL,
  tau_bps INTEGER NOT NULL,
  vol_crush_bps INTEGER NOT NULL,
  sigma_eff_tenths INTEGER NOT NULL,
  snapshot_ts BIGINT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iv_history_pool_ts ON iv_history(pool_id, snapshot_ts DESC);

CREATE TABLE IF NOT EXISTS arbitration_cases (
  case_id TEXT PRIMARY KEY,
  assertion_id TEXT NOT NULL,
  feed_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  proposer TEXT NOT NULL,
  disputer TEXT NOT NULL,
  claimed_value BIGINT NOT NULL,
  verdict_type INTEGER NOT NULL DEFAULT 0,
  resolved_value BIGINT,
  status INTEGER NOT NULL DEFAULT 0,
  required_approvals INTEGER NOT NULL DEFAULT 0,
  approvals JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  opened_tx_digest TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arbitration_pool ON arbitration_cases(pool_id);
CREATE INDEX IF NOT EXISTS idx_arbitration_status ON arbitration_cases(status);

CREATE TABLE IF NOT EXISTS buyer_roi (
  id SERIAL PRIMARY KEY,
  buyer TEXT NOT NULL,
  prophecy_id TEXT NOT NULL REFERENCES prophecies(prophecy_id) ON DELETE CASCADE,
  prophet TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  unlock_cost BIGINT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'pending',
  predicted_value BIGINT,
  roi_bps INTEGER,
  audited_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer, prophecy_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_roi_buyer ON buyer_roi(buyer);

CREATE TABLE IF NOT EXISTS chain_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  tx_digest TEXT NOT NULL,
  event_seq BIGINT,
  timestamp_ms BIGINT NOT NULL,
  parsed_json JSONB NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chain_events_dedup ON chain_events(event_type, tx_digest, event_seq);
