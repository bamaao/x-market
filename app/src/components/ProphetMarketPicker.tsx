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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import Link from "next/link";
import type { MarketKind, SeedMarket } from "@/lib/markets";
import { SEED_MARKETS } from "@/lib/markets";
import {
  indexerRowsToSeeds,
  loadUserMarkets,
  mergeMarkets,
} from "@/lib/market-catalog";
import {
  fetchIndexerMarkets,
  INDEXER_MARKET_PAGE_SIZE,
  indexerEnabled,
} from "@/lib/indexer";
import {
  marketMatchesSearch,
  marketMatchesTagFilter,
  topLevelThemeFilters,
} from "@/lib/market-tags";
import { MarketTagList } from "@/components/MarketTagList";
import { VirtualScrollList } from "@/components/VirtualScrollList";
import {
  assessProphetMarketEligibility,
  parsePoolSnapshotFromFields,
  prophetStatusClass,
  sortProphetPoolOptions,
  type ProphetPoolOption,
} from "@/lib/prophet-market-eligibility";
import {
  localizedProphetEligibilityReason,
  localizedProphetPoolStatus,
  localizedRemainingTime,
} from "@/i18n/domain";
import { useLocalizedTagLabel } from "@/i18n/markets";
import { useT } from "@/i18n/context";
import type { Translator } from "@/i18n/core";

const KIND_LABELS: Record<MarketKind, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

const PROPHET_MARKET_ROW_HEIGHT = 118;

function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

type Props = {
  poolId: string;
  nowSec: number;
  onSelect: (option: ProphetPoolOption | null) => void;
};

function mergeMarketPages(prev: SeedMarket[], next: SeedMarket[]): SeedMarket[] {
  return mergeMarkets([], [], [...prev, ...next]);
}

function ProphetMarketRow({
  option,
  active,
  onSelect,
  t,
}: {
  option: ProphetPoolOption;
  active: boolean;
  onSelect: () => void;
  t: Translator;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={`prophet-market-item prophet-market-row${active ? " active" : ""}${
        !option.eligibility.canCommit ? " disabled-commit" : ""
      }`}
      onClick={onSelect}
    >
      <div className="prophet-market-item-head">
        <span className={`badge badge-${option.market.kind}`}>
          {KIND_LABELS[option.market.kind]}
        </span>
        <MarketTagList tags={option.market.tags} max={3} />
        <span className={prophetStatusClass(option.eligibility.status)}>
          {localizedProphetPoolStatus(option.eligibility.status, t)}
        </span>
      </div>
      <strong className="oracle-market-row-title">{option.market.title}</strong>
      <p className="oracle-market-row-desc">{option.market.description}</p>
      <div className="prophet-market-item-foot">
        <span>
          {t("prophet.pickerRemaining", {
            time: localizedRemainingTime(option.eligibility.remainingSecs, t),
          })}
        </span>
        <code className="mono">{option.poolId.slice(0, 10)}…</code>
      </div>
      {!option.eligibility.canCommit && (
        <span className="prophet-market-item-reason">
          {localizedProphetEligibilityReason(option.eligibility, t)}
        </span>
      )}
    </button>
  );
}

export function ProphetMarketPicker({ poolId, nowSec, onSelect }: Props) {
  const t = useT();
  const tagLabel = useLocalizedTagLabel();
  const client = useSuiClient();
  const [markets, setMarkets] = useState<SeedMarket[]>(() =>
    mergeMarkets(SEED_MARKETS, loadUserMarkets(), []),
  );
  const [chainSnapshots, setChainSnapshots] = useState<
    Record<string, ReturnType<typeof parsePoolSnapshotFromFields>>
  >({});
  const [kindFilter, setKindFilter] = useState<"all" | MarketKind>("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [themeTabs] = useState(topLevelThemeFilters());
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const loadingMoreRef = useRef(false);
  const fetchedSnapshotsRef = useRef(new Set<string>());

  const kindFilters = useMemo(
    (): { value: "all" | MarketKind; label: string }[] => [
      { value: "all", label: t("markets.kindAll") },
      { value: "poisson", label: "Poisson" },
      { value: "dirichlet", label: "Dirichlet" },
      { value: "normal", label: "Normal" },
      { value: "beta", label: "Beta" },
    ],
    [t],
  );

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const loadMarketPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!indexerEnabled()) {
        const local = mergeMarkets(SEED_MARKETS, loadUserMarkets(), []);
        setMarkets(local);
        setTotal(local.length);
        setHasMore(false);
        setNextOffset(local.length);
        return;
      }

      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoadingMarkets(true);
      }

      try {
        const serverSearch = debouncedQuery.length >= 2;
        const { markets: rows, pagination } = await fetchIndexerMarkets({
          kind: kindFilter !== "all" ? kindFilter : undefined,
          tag: themeFilter !== "all" ? themeFilter : undefined,
          q: serverSearch ? debouncedQuery : undefined,
          limit: INDEXER_MARKET_PAGE_SIZE,
          offset,
        });
        const pageSeeds = indexerRowsToSeeds(rows);
        setMarkets((prev) => {
          if (!append) {
            return mergeMarkets(SEED_MARKETS, loadUserMarkets(), pageSeeds);
          }
          return mergeMarketPages(prev, pageSeeds);
        });
        setTotal(pagination?.total ?? pageSeeds.length);
        setHasMore(pagination?.has_more ?? false);
        setNextOffset(offset + pageSeeds.length);
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoadingMarkets(false);
        }
      }
    },
    [debouncedQuery, kindFilter, themeFilter],
  );

  useEffect(() => {
    void loadMarketPage(0, false);
  }, [loadMarketPage]);

  const poolIds = useMemo(
    () =>
      [
        ...new Set(
          markets
            .map((m) => String(m.params.poolId ?? "").trim())
            .filter(Boolean),
        ),
      ],
    [markets],
  );

  useEffect(() => {
    const missing = poolIds.filter((id) => !fetchedSnapshotsRef.current.has(id));
    if (missing.length === 0) {
      setLoadingSnapshots(false);
      return;
    }
    let cancelled = false;
    setLoadingSnapshots(true);

    void (async () => {
      for (let i = 0; i < missing.length; i += INDEXER_MARKET_PAGE_SIZE) {
        if (cancelled) return;
        const chunk = missing.slice(i, i + INDEXER_MARKET_PAGE_SIZE);
        try {
          const objects = await client.multiGetObjects({
            ids: chunk,
            options: { showContent: true },
          });
          if (cancelled) return;
          setChainSnapshots((prev) => {
            const next = { ...prev };
            for (let j = 0; j < chunk.length; j++) {
              const id = chunk[j];
              fetchedSnapshotsRef.current.add(id);
              const fields = parseMoveFields(objects[j]?.data?.content);
              next[id] = parsePoolSnapshotFromFields(id, fields);
            }
            return next;
          });
        } catch {
          break;
        }
      }
      if (!cancelled) setLoadingSnapshots(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [client, poolIds.join(",")]);

  const options = useMemo((): ProphetPoolOption[] => {
    return markets
      .map((market) => {
        const pid = String(market.params.poolId ?? "").trim();
        const snapshot =
          chainSnapshots[pid] ?? parsePoolSnapshotFromFields(pid, undefined);
        return {
          market,
          poolId: pid,
          snapshot,
          eligibility: assessProphetMarketEligibility(nowSec, snapshot),
        };
      })
      .filter((o) => o.poolId.length > 0);
  }, [markets, chainSnapshots, nowSec]);

  const filtered = useMemo(() => {
    const searching = debouncedQuery.length > 0 && debouncedQuery.length < 2;
    const localOnly = !indexerEnabled() || searching;
    return sortProphetPoolOptions(
      options.filter((o) => {
        if (localOnly) {
          if (kindFilter !== "all" && o.market.kind !== kindFilter) return false;
          if (!marketMatchesTagFilter(o.market.tags, themeFilter)) return false;
          if (debouncedQuery && !marketMatchesSearch(o.market, debouncedQuery, o.market.tags)) {
            return false;
          }
        }
        return true;
      }),
    );
  }, [options, kindFilter, themeFilter, debouncedQuery]);

  const openCount = filtered.filter((o) => o.eligibility.canCommit).length;
  const loading = loadingMarkets || (loadingSnapshots && filtered.length > 0);

  useEffect(() => {
    if (loading) return;
    if (filtered.length === 0) {
      if (poolId) onSelect(null);
      return;
    }
    const inFiltered = filtered.some((o) => o.poolId === poolId);
    if (inFiltered) return;
    const preferred =
      filtered.find((o) => o.eligibility.canCommit) ?? filtered[0];
    if (preferred) onSelect(preferred);
  }, [loading, filtered, poolId, onSelect]);

  const selected = filtered.find((o) => o.poolId === poolId) ?? null;

  const loadMore = useCallback(() => {
    if (loadingMarkets || loadingMore || !hasMore || !indexerEnabled()) return;
    void loadMarketPage(nextOffset, true);
  }, [loadingMarkets, loadingMore, hasMore, nextOffset, loadMarketPage]);

  const handleSelectOption = useCallback(
    (key: string) => {
      const option = filtered.find((o) => o.poolId === key);
      if (option) onSelect(option);
    },
    [filtered, onSelect],
  );

  return (
    <div className="prophet-market-picker">
      <div className="prophet-market-picker-toolbar">
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

      <p className="hint prophet-market-picker-meta">
        {loading && filtered.length === 0 ? (
          t("prophet.pickerMetaLoading")
        ) : (
          <>
            {indexerEnabled() && total > 0
              ? t("prophet.pickerMetaTotal", {
                  total,
                  loaded: filtered.length,
                  open: openCount,
                })
              : t("prophet.pickerMetaLocal", {
                  count: filtered.length,
                  open: openCount,
                })}
            {themeFilter !== "all" &&
              t("prophet.pickerTheme", { tag: tagLabel(themeFilter) })}
            {debouncedQuery.length >= 2 &&
              t("prophet.pickerSearch", { q: debouncedQuery })}
            {loadingMore && t("oracle.pickerLoadingMore")}
            {loadingSnapshots && t("prophet.pickerSyncing")}
          </>
        )}
      </p>

      <VirtualScrollList
        items={filtered}
        itemKey={(o) => o.poolId}
        itemHeight={PROPHET_MARKET_ROW_HEIGHT}
        height={360}
        className="oracle-virtual-list prophet-market-list"
        onNearEnd={loadMore}
        scrollToKey={poolId || null}
        selectedKey={poolId || null}
        keyboardNav
        onSelectKey={handleSelectOption}
        empty={
          !loading ? (
            <div className="prophet-market-empty">{t("prophet.pickerEmpty")}</div>
          ) : (
            <div className="prophet-market-empty">{t("common.loading")}</div>
          )
        }
        renderItem={(o, _index, { active }) => (
          <ProphetMarketRow
            option={o}
            active={active || o.poolId === poolId}
            onSelect={() => onSelect(o)}
            t={t}
          />
        )}
        aria-label={t("prophet.pickerListAria")}
      />
      <p className="hint oracle-list-kbd-hint">{t("prophet.pickerKbdHint")}</p>

      {selected && (
        <div className="prophet-market-selected-hint">
          <p className="hint">
            {t("prophet.pickerSelected")}{" "}
            <strong>{selected.market.title}</strong>
            {selected.snapshot.maturityTs > 0 && (
              <>
                {" "}
                {t("prophet.pickerMaturity")}{" "}
                {new Date(selected.snapshot.maturityTs * 1000).toLocaleString()}
              </>
            )}
            {!selected.eligibility.canCommit && (
              <> · {localizedProphetEligibilityReason(selected.eligibility, t)}</>
            )}
          </p>
          <Link href={`/markets/${selected.market.id}`} className="card-cta">
            {t("prophet.pickerOpenMarket")}
          </Link>
        </div>
      )}
    </div>
  );
}
