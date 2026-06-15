// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

/** Off-chain market themes (orthogonal to kind / distribution). */

export interface MarketTag {
  slug: string;
  label: string;
  parentSlug?: string;
}

export const MARKET_TAG_CATALOG: MarketTag[] = [
  { slug: "sports", label: "Sports" },
  { slug: "football", label: "Football", parentSlug: "sports" },
  { slug: "world-cup", label: "World Cup", parentSlug: "football" },
  { slug: "macro", label: "Macro" },
  { slug: "economy", label: "Economy", parentSlug: "macro" },
  { slug: "cpi", label: "CPI", parentSlug: "economy" },
  { slug: "politics", label: "Politics" },
  { slug: "election", label: "Election", parentSlug: "politics" },
  { slug: "crypto", label: "Crypto" },
  { slug: "other", label: "Other" },
];

export const SEED_MARKET_TAGS: Record<string, string[]> = {
  "poisson-goals": ["sports", "football"],
  "dirichlet-wdl": ["sports", "football"],
  "normal-cpi": ["macro", "economy", "cpi"],
  "beta-vote": ["politics", "election"],
};

const TAG_BY_SLUG = new Map(MARKET_TAG_CATALOG.map((t) => [t.slug, t]));

export function tagLabel(slug: string): string {
  return TAG_BY_SLUG.get(slug)?.label ?? slug;
}

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

export function tagsForSeedMarket(id: string, fromIndexer?: string[] | null): string[] {
  if (fromIndexer?.length) return fromIndexer;
  return SEED_MARKET_TAGS[id] ?? [];
}

/** All descendant slugs under a tag (inclusive), for hierarchical theme filter. */
export function tagDescendantSlugs(slug: string): string[] {
  const out = new Set<string>([slug]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of MARKET_TAG_CATALOG) {
      if (t.parentSlug && out.has(t.parentSlug) && !out.has(t.slug)) {
        out.add(t.slug);
        changed = true;
      }
    }
  }
  return [...out];
}

export function marketMatchesTagFilter(
  tags: string[] | undefined,
  tagFilter: string,
): boolean {
  if (!tagFilter || tagFilter === "all") return true;
  const marketTags = tags ?? [];
  if (marketTags.includes(tagFilter)) return true;
  const scope = tagDescendantSlugs(tagFilter);
  return marketTags.some((t) => scope.includes(t));
}

export function marketMatchesSearch(
  market: { id: string; title: string; description: string; params: Record<string, string | number> },
  query: string,
  tags?: string[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const poolId = String(market.params.poolId ?? "");
  const tagText = (tags ?? []).map(tagLabel).join(" ");
  const haystack = [market.title, market.description, market.id, poolId, tagText]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Top-level theme tabs for filters (exclude deep children where parent exists). */
export function topLevelThemeFilters(): MarketTag[] {
  return MARKET_TAG_CATALOG.filter(
    (t) => !t.parentSlug || !MARKET_TAG_CATALOG.some((p) => p.slug === t.parentSlug && !p.parentSlug),
  ).filter((t) => ["sports", "macro", "politics", "crypto", "other"].includes(t.slug));
}

export function catalogTagsForPicker(): MarketTag[] {
  return MARKET_TAG_CATALOG.filter((t) => t.slug !== "other");
}
