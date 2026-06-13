-- Off-chain prophet follow graph (MVP social layer)
CREATE TABLE IF NOT EXISTS prophet_follows (
  follower TEXT NOT NULL,
  prophet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower, prophet),
  CHECK (follower <> prophet)
);

CREATE INDEX IF NOT EXISTS idx_prophet_follows_follower ON prophet_follows(follower);
CREATE INDEX IF NOT EXISTS idx_prophet_follows_prophet ON prophet_follows(prophet);
