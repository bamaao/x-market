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

-- P4: market themes (orthogonal to kind / distribution type)

CREATE TABLE IF NOT EXISTS tags (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  parent_slug TEXT REFERENCES tags(slug) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_tags (
  pool_id TEXT NOT NULL REFERENCES markets(pool_id) ON DELETE CASCADE,
  tag_slug TEXT NOT NULL REFERENCES tags(slug) ON DELETE CASCADE,
  PRIMARY KEY (pool_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS idx_market_tags_tag ON market_tags(tag_slug);

INSERT INTO tags (slug, label, parent_slug, sort_order) VALUES
  ('sports', '体育', NULL, 10),
  ('football', '足球', 'sports', 11),
  ('world-cup', '世界杯', 'football', 12),
  ('macro', '宏观', NULL, 20),
  ('economy', '经济', 'macro', 21),
  ('cpi', 'CPI', 'economy', 22),
  ('politics', '政治', NULL, 30),
  ('election', '选举', 'politics', 31),
  ('crypto', '加密', NULL, 40),
  ('other', '其他', NULL, 99)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO market_tags (pool_id, tag_slug)
SELECT m.pool_id, t.tag FROM markets m
JOIN (VALUES
  ('poisson-goals', 'sports'),
  ('poisson-goals', 'football'),
  ('dirichlet-wdl', 'sports'),
  ('dirichlet-wdl', 'football'),
  ('normal-cpi', 'macro'),
  ('normal-cpi', 'economy'),
  ('normal-cpi', 'cpi'),
  ('beta-vote', 'politics'),
  ('beta-vote', 'election')
) AS t(slug, tag) ON m.slug = t.slug
ON CONFLICT DO NOTHING;
