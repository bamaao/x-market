"use client";

import { useEffect, useMemo, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import Link from "next/link";
import type { MarketKind, SeedMarket } from "@/lib/markets";
import { SEED_MARKETS } from "@/lib/markets";
import {
  indexerRowsToSeeds,
  loadUserMarkets,
  mergeMarkets,
} from "@/lib/market-catalog";
import { fetchIndexerMarkets, indexerEnabled } from "@/lib/indexer";
import {
  marketMatchesSearch,
  marketMatchesTagFilter,
  tagLabel,
  topLevelThemeFilters,
} from "@/lib/market-tags";
import { MarketTagList } from "@/components/MarketTagList";
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

export function ProphetMarketPicker({ poolId, nowSec, onSelect }: Props) {
  const client = useSuiClient();
  const [markets, setMarkets] = useState<SeedMarket[]>(SEED_MARKETS);
  const [chainSnapshots, setChainSnapshots] = useState<
    Record<string, ReturnType<typeof parsePoolSnapshotFromFields>>
  >({});
  const [kindFilter, setKindFilter] = useState<"all" | MarketKind>("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [themeTabs, setThemeTabs] = useState(topLevelThemeFilters());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = loadUserMarkets();
    setMarkets(mergeMarkets(SEED_MARKETS, user, []));
    if (!indexerEnabled()) return;
    void fetchIndexerMarkets().then((rows) => {
      setMarkets(mergeMarkets(SEED_MARKETS, user, indexerRowsToSeeds(rows)));
    });
  }, []);

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
    if (poolIds.length === 0) {
      setChainSnapshots({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void client
      .multiGetObjects({
        ids: poolIds,
        options: { showContent: true },
      })
      .then((objects) => {
        if (cancelled) return;
        const next: Record<string, ReturnType<typeof parsePoolSnapshotFromFields>> =
          {};
        for (let i = 0; i < poolIds.length; i++) {
          const id = poolIds[i];
          const fields = parseMoveFields(objects[i]?.data?.content);
          next[id] = parsePoolSnapshotFromFields(id, fields);
        }
        setChainSnapshots(next);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, poolIds.join(",")]);

  const options = useMemo((): ProphetPoolOption[] => {
    return markets
      .map((market) => {
        const pid = String(market.params.poolId ?? "").trim();
        const snapshot =
          chainSnapshots[pid] ??
          parsePoolSnapshotFromFields(pid, undefined);
        return {
          market,
          poolId: pid,
          snapshot,
          eligibility: assessProphetMarketEligibility(nowSec, snapshot),
        };
      })
      .filter((o) => o.poolId.length > 0);
  }, [markets, chainSnapshots, nowSec]);

  const sorted = useMemo(() => sortProphetPoolOptions(options), [options]);

  const filtered = useMemo(() => {
    return sorted.filter((o) => {
      if (kindFilter !== "all" && o.market.kind !== kindFilter) return false;
      if (!marketMatchesTagFilter(o.market.tags, themeFilter)) return false;
      return marketMatchesSearch(o.market, query, o.market.tags);
    });
  }, [sorted, kindFilter, themeFilter, query]);

  const openCount = options.filter((o) => o.eligibility.canCommit).length;

  // Keep selection in sync with filters — only pick from `filtered`, never from full list.
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
        {loading ? (
          "正在同步链上 Pool 状态…"
        ) : (
          <>
            共 {options.length} 个市场 · {openCount} 个可预测
            {themeFilter !== "all" && ` · 主题 ${tagLabel(themeFilter)}`}
            {query.trim() && ` · 筛选结果 ${filtered.length} 个`}
          </>
        )}
      </p>

      <ul className="prophet-market-list" role="listbox" aria-label="选择市场">
        {filtered.length === 0 ? (
          <li className="prophet-market-empty">
            {loading ? "加载中…" : "无匹配市场，请调整筛选或搜索词"}
          </li>
        ) : (
          filtered.map((o) => {
            const active = o.poolId === poolId;
            return (
              <li key={o.poolId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`prophet-market-item${active ? " active" : ""}${
                    !o.eligibility.canCommit ? " disabled-commit" : ""
                  }`}
                  onClick={() => onSelect(o)}
                >
                  <div className="prophet-market-item-head">
                    <span className={`badge badge-${o.market.kind}`}>
                      {KIND_LABELS[o.market.kind]}
                    </span>
                    <MarketTagList tags={o.market.tags} max={3} />
                    <span className={prophetStatusClass(o.eligibility.status)}>
                      {prophetStatusLabel(o.eligibility.status)}
                    </span>
                  </div>
                  <strong>{o.market.title}</strong>
                  <p>{o.market.description}</p>
                  <div className="prophet-market-item-foot">
                    <span>
                      剩余 {formatRemainingTime(o.eligibility.remainingSecs)}
                    </span>
                    <code className="mono">{o.poolId.slice(0, 10)}…</code>
                  </div>
                  {!o.eligibility.canCommit && (
                    <span className="prophet-market-item-reason">
                      {o.eligibility.reason}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

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
