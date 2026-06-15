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

"use client";

import { useEffect, useMemo, useState } from "react";
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
  topLevelThemeFilters,
} from "@/lib/market-tags";
import { useI18n, useT } from "@/i18n/context";
import { localizeSeedMarket } from "@/i18n/markets";
import { useLocalizedTagLabel } from "@/i18n/markets";

const KIND_LABELS: Record<MarketKind, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

function kindBadgeClass(kind: MarketKind): string {
  return `badge badge-${kind}`;
}

export function MarketsGrid() {
  const t = useT();
  const { locale } = useI18n();
  const tagLabel = useLocalizedTagLabel();
  const [markets, setMarkets] = useState<SeedMarket[]>(SEED_MARKETS);
  const [source, setSource] = useState<"env" | "indexer">("env");
  const [kindFilter, setKindFilter] = useState<"all" | MarketKind>("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const themeTabs = useMemo(() => topLevelThemeFilters(), []);

  const kindFilters = useMemo(
    () =>
      [
        { value: "all" as const, label: t("markets.kindAll") },
        { value: "poisson" as const, label: "Poisson" },
        { value: "dirichlet" as const, label: "Dirichlet" },
        { value: "normal" as const, label: "Normal" },
        { value: "beta" as const, label: "Beta" },
      ] as const,
    [t],
  );

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

  const localizedMarkets = useMemo(
    () => markets.map((m) => localizeSeedMarket(m, locale, t)),
    [markets, locale, t],
  );

  const filtered = localizedMarkets.filter((m) => {
    if (kindFilter !== "all" && m.kind !== kindFilter) return false;
    if (!marketMatchesTagFilter(m.tags, themeFilter)) return false;
    return marketMatchesSearch(m, query, m.tags);
  });

  return (
    <>
      <div className="market-filters-bar">
        <div className="prophet-kind-tabs" role="tablist" aria-label={t("markets.kindTabAria")}>
          {kindFilters.map((f) => (
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
          <span className="prophet-filter-label">{t("markets.themeLabel")}</span>
          <div className="prophet-kind-tabs" role="tablist" aria-label={t("markets.themeTabAria")}>
            <button
              type="button"
              role="tab"
              aria-selected={themeFilter === "all"}
              className={themeFilter === "all" ? "active" : undefined}
              onClick={() => setThemeFilter("all")}
            >
              {t("markets.themeAll")}
            </button>
            {themeTabs.map((tab) => (
              <button
                key={tab.slug}
                type="button"
                role="tab"
                aria-selected={themeFilter === tab.slug}
                className={themeFilter === tab.slug ? "active" : undefined}
                onClick={() => setThemeFilter(tab.slug)}
              >
                {tagLabel(tab.slug)}
              </button>
            ))}
          </div>
        </div>
        <input
          type="search"
          className="prophet-market-search"
          placeholder={t("markets.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("markets.searchAria")}
        />
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="label">{t("markets.statCount")}</div>
          <div className="value accent">{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t("markets.statKinds")}</div>
          <div className="value">4</div>
        </div>
        {themeFilter !== "all" && (
          <div className="stat-card">
            <div className="label">{t("markets.statTheme")}</div>
            <div className="value" style={{ fontSize: "0.95rem" }}>
              {tagLabel(themeFilter)}
            </div>
          </div>
        )}
        {indexerEnabled() && (
          <div className="stat-card">
            <div className="label">{t("markets.statSource")}</div>
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
            {source === "indexer" ? t("markets.sourceIndexer") : t("markets.indexerFallback")}
          </span>
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="hint">{t("markets.noMatch")}</p>
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
                  <span className="card-cta">{t("markets.tradeCta")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
