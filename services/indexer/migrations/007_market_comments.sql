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

-- Off-chain market comments (wallet-signed, Indexer-only)
CREATE TABLE IF NOT EXISTS market_comments (
  id          BIGSERIAL PRIMARY KEY,
  pool_id     TEXT NOT NULL,
  author      TEXT NOT NULL,
  body        TEXT NOT NULL,
  nonce       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (author, nonce)
);

CREATE INDEX IF NOT EXISTS idx_market_comments_pool_created
  ON market_comments (pool_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_market_comments_author_created
  ON market_comments (author, created_at DESC)
  WHERE deleted_at IS NULL;
