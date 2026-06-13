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
