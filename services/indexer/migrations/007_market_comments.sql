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
