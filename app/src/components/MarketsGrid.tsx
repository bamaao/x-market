"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SEED_MARKETS,
  type MarketKind,
  type SeedMarket,
} from "@/lib/markets";
import { fetchIndexerMarkets, indexerEnabled } from "@/lib/indexer";
import {
  indexerRowsToSeeds,
  loadUserMarkets,
  mergeMarkets,
} from "@/lib/market-catalog";
import { MarketCover } from "@/components/MarketCover";
import { MarketTagList } from "@/components/MarketTagList";
import {
  marketMatchesSearch,
  marketMatchesTagFilter,
  tagLabel,
  topLevelThemeFilters,
} from "@/lib/market-tags";

const KIND_LABELS: Record<MarketKind, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

const KIND_FILTERS: { value: "all" | MarketKind; label: string }[] = [
  { value: "all", label: "全部分布" },
  { value: "poisson", label: "Poisson" },
  { value: "dirichlet", label: "Dirichlet" },
  { value: "normal", label: "Normal" },
  { value: "beta", label: "Beta" },
];

function kindBadgeClass(kind: MarketKind): string {
  return `badge badge-${kind}`;
}

export function MarketsGrid() {
  const [markets, setMarkets] = useState<SeedMarket[]>(SEED_MARKETS);
  const [source, setSource] = useState<"env" | "indexer">("env");
  const [kindFilter, setKindFilter] = useState<"all" | MarketKind>("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [themeTabs, setThemeTabs] = useState(topLevelThemeFilters());

  useEffect(() => {
    const user = loadUserMarkets();
    const base = mergeMarkets(SEED_MARKETS, user, []);
    setMarkets(base);

    if (!indexerEnabled()) return;
    void fetchIndexerMarkets().then(({ markets: rows }) => {
      const indexer = rows.length ? indexerRowsToSeeds(rows) : [];
      setMarkets(mergeMarkets(SEED_MARKETS, user, indexer));
      if (rows.length) setSource("indexer");
    });
  }, []);

  const filtered = markets.filter((m) => {
    if (kindFilter !== "all" && m.kind !== kindFilter) return false;
    if (!marketMatchesTagFilter(m.tags, themeFilter)) return false;
    return marketMatchesSearch(m, query, m.tags);
  });

  return (
    <>
      <div className="market-filters-bar">
        <div className="prophet-kind-tabs" role="tablist" aria-label="分布类型">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={kindFilter === f.value}
              className={kindFilter === f.value ? "active" : undefined}
              onClick={() => setKindFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="prophet-filter-group">
          <span className="prophet-filter-label">主题</span>
          <div className="prophet-kind-tabs" role="tablist" aria-label="主题筛选">
          <button
            type="button"
            role="tab"
            aria-selected={themeFilter === "all"}
            className={themeFilter === "all" ? "active" : undefined}
            onClick={() => setThemeFilter("all")}
          >
            全部
          </button>
          {themeTabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              role="tab"
              aria-selected={themeFilter === t.slug}
              className={themeFilter === t.slug ? "active" : undefined}
              onClick={() => setThemeFilter(t.slug)}
            >
              {t.label}
            </button>
          ))}
          </div>
        </div>
        <input
          type="search"
          className="prophet-market-search"
          placeholder="搜索市场标题、描述、主题…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索市场"
        />
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="label">市场数量</div>
          <div className="value accent">{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">分布类型</div>
          <div className="value">4</div>
        </div>
        {themeFilter !== "all" && (
          <div className="stat-card">
            <div className="label">主题</div>
            <div className="value" style={{ fontSize: "0.95rem" }}>
              {tagLabel(themeFilter)}
            </div>
          </div>
        )}
        {indexerEnabled() && (
          <div className="stat-card">
            <div className="label">数据源</div>
            <div className="value" style={{ fontSize: "0.95rem" }}>
              {source === "indexer" ? "Indexer" : "Env"}
            </div>
          </div>
        )}
      </div>

      {indexerEnabled() && (
        <p style={{ marginBottom: "1rem" }}>
          <span className="source-badge">
            <span className={`dot${source === "indexer" ? "" : " offline"}`} />
            {source === "indexer" ? "Indexer API 实时同步" : "环境变量种子市场（Indexer 回退）"}
          </span>
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="hint">无匹配市场，请调整分布、主题或搜索词。</p>
      ) : (
        <div className="grid grid-markets">
          {filtered.map((m) => (
            <Link
              key={m.id}
              href={`/markets/${m.id}`}
              className="card card-interactive market-card"
            >
              <MarketCover
                id={m.id}
                imageUrl={m.imageUrl}
                title={m.title}
                kind={m.kind}
                variant="card"
              />
              <div className="market-card-body">
                <span className={kindBadgeClass(m.kind)}>{KIND_LABELS[m.kind]}</span>
                <MarketTagList tags={m.tags} />
                <h2>{m.title}</h2>
                <p>{m.description}</p>
                <div className="card-footer">
                  {m.params.poolId ? (
                    <span className="hint" style={{ margin: 0, fontSize: "0.72rem" }}>
                      Pool {String(m.params.poolId).slice(0, 8)}…
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="card-cta">交易 →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
