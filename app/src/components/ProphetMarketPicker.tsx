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
  tagLabel,
  topLevelThemeFilters,
} from "@/lib/market-tags";
import { MarketTagList } from "@/components/MarketTagList";
import { VirtualScrollList } from "@/components/VirtualScrollList";
import {
  assessProphetMarketEligibility,
  formatRemainingTime,
  parsePoolSnapshotFromFields,
  prophetStatusClass,
  prophetStatusLabel,
  sortProphetPoolOptions,
  type ProphetPoolOption,
} from "@/lib/prophet-market-eligibility";

const KIND_FILTERS: { value: "all" | MarketKind; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "poisson", label: "Poisson" },
  { value: "dirichlet", label: "Dirichlet" },
  { value: "normal", label: "Normal" },
  { value: "beta", label: "Beta" },
];

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
}: {
  option: ProphetPoolOption;
  active: boolean;
  onSelect: () => void;
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
          {prophetStatusLabel(option.eligibility.status)}
        </span>
      </div>
      <strong className="oracle-market-row-title">{option.market.title}</strong>
      <p className="oracle-market-row-desc">{option.market.description}</p>
      <div className="prophet-market-item-foot">
        <span>剩余 {formatRemainingTime(option.eligibility.remainingSecs)}</span>
        <code className="mono">{option.poolId.slice(0, 10)}…</code>
      </div>
      {!option.eligibility.canCommit && (
        <span className="prophet-market-item-reason">{option.eligibility.reason}</span>
      )}
    </button>
  );
}

export function ProphetMarketPicker({ poolId, nowSec, onSelect }: Props) {
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
          placeholder="搜索标题、描述、主题或 Pool ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索市场"
        />
      </div>

      <p className="hint prophet-market-picker-meta">
        {loading && filtered.length === 0 ? (
          "正在加载市场…"
        ) : (
          <>
            {indexerEnabled() && total > 0
              ? `共 ${total} 个 · 已加载 ${filtered.length} 个 · ${openCount} 个可预测`
              : `共 ${filtered.length} 个市场 · ${openCount} 个可预测`}
            {themeFilter !== "all" && ` · 主题 ${tagLabel(themeFilter)}`}
            {debouncedQuery.length >= 2 && ` · 搜索「${debouncedQuery}」`}
            {loadingMore && " · 加载更多…"}
            {loadingSnapshots && " · 同步链上状态…"}
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
            <div className="prophet-market-empty">
              无匹配市场，请调整筛选或搜索词
            </div>
          ) : (
            <div className="prophet-market-empty">加载中…</div>
          )
        }
        renderItem={(o, _index, { active }) => (
          <ProphetMarketRow
            option={o}
            active={active || o.poolId === poolId}
            onSelect={() => onSelect(o)}
          />
        )}
        aria-label="选择市场"
      />
      <p className="hint oracle-list-kbd-hint">
        列表聚焦后可用 ↑↓ 浏览、Enter 选中；滚到底自动加载更多。
      </p>

      {selected && (
        <div className="prophet-market-selected-hint">
          <p className="hint">
            已选：<strong>{selected.market.title}</strong>
            {selected.snapshot.maturityTs > 0 && (
              <>
                {" "}
                · 到期{" "}
                {new Date(selected.snapshot.maturityTs * 1000).toLocaleString()}
              </>
            )}
            {!selected.eligibility.canCommit && (
              <> · {selected.eligibility.reason}</>
            )}
          </p>
          <Link href={`/markets/${selected.market.id}`} className="card-cta">
            打开市场页 →
          </Link>
        </div>
      )}
    </div>
  );
}
