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

-- P2: off-chain market cover URLs (Indexer / CDN / app public path)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE markets SET image_url = '/markets/poisson-goals.svg'
  WHERE slug = 'poisson-goals' AND (image_url IS NULL OR image_url = '');
UPDATE markets SET image_url = '/markets/dirichlet-wdl.svg'
  WHERE slug = 'dirichlet-wdl' AND (image_url IS NULL OR image_url = '');
UPDATE markets SET image_url = '/markets/normal-cpi.svg'
  WHERE slug = 'normal-cpi' AND (image_url IS NULL OR image_url = '');
UPDATE markets SET image_url = '/markets/beta-vote.svg'
  WHERE slug = 'beta-vote' AND (image_url IS NULL OR image_url = '');
