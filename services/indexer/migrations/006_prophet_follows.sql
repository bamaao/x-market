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
