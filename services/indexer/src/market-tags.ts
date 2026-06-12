import { query } from "./db.js";

export interface TagRow {
  slug: string;
  label: string;
  parent_slug: string | null;
  sort_order: number;
}

/** Default tags for seed markets (by market slug). */
export const SEED_MARKET_TAGS: Record<string, string[]> = {
  "poisson-goals": ["sports", "football"],
  "dirichlet-wdl": ["sports", "football"],
  "normal-cpi": ["macro", "economy", "cpi"],
  "beta-vote": ["politics", "election"],
};

const TAG_LABELS: Record<string, string> = {
  sports: "体育",
  football: "足球",
  "world-cup": "世界杯",
  macro: "宏观",
  economy: "经济",
  cpi: "CPI",
  politics: "政治",
  election: "选举",
  crypto: "加密",
  other: "其他",
};

export function normalizeTagSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    const slug = String(raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    if (!slug || out.includes(slug)) continue;
    out.push(slug);
    if (out.length >= 8) break;
  }
  return out;
}

export async function ensureTag(
  databaseUrl: string,
  slug: string,
  label?: string,
): Promise<void> {
  await query(
    databaseUrl,
    `INSERT INTO tags (slug, label, sort_order) VALUES ($1, $2, 50)
     ON CONFLICT (slug) DO NOTHING`,
    [slug, label ?? TAG_LABELS[slug] ?? slug],
  );
}

export async function syncMarketTags(
  databaseUrl: string,
  poolId: string,
  tagSlugs: string[],
): Promise<void> {
  const slugs = normalizeTagSlugs(tagSlugs);
  for (const slug of slugs) {
    await ensureTag(databaseUrl, slug);
  }
  await query(databaseUrl, `DELETE FROM market_tags WHERE pool_id = $1`, [poolId]);
  for (const slug of slugs) {
    await query(
      databaseUrl,
      `INSERT INTO market_tags (pool_id, tag_slug) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [poolId, slug],
    );
  }
}

export async function listTags(databaseUrl: string): Promise<TagRow[]> {
  const res = await query<TagRow>(
    databaseUrl,
    `SELECT slug, label, parent_slug, sort_order FROM tags ORDER BY sort_order ASC, label ASC`,
  );
  return res.rows;
}

export async function tagsByPoolIds(
  databaseUrl: string,
  poolIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!poolIds.length) return map;
  const res = await query<{ pool_id: string; tag_slug: string }>(
    databaseUrl,
    `SELECT pool_id, tag_slug FROM market_tags WHERE pool_id = ANY($1::text[])
     ORDER BY tag_slug ASC`,
    [poolIds],
  );
  for (const row of res.rows) {
    const list = map.get(row.pool_id) ?? [];
    list.push(row.tag_slug);
    map.set(row.pool_id, list);
  }
  return map;
}

export async function attachTagsToMarkets<T extends { pool_id: string }>(
  databaseUrl: string,
  markets: T[],
): Promise<Array<T & { tags: string[] }>> {
  const tagMap = await tagsByPoolIds(
    databaseUrl,
    markets.map((m) => m.pool_id),
  );
  return markets.map((m) => ({
    ...m,
    tags: tagMap.get(m.pool_id) ?? [],
  }));
}
