"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketKind } from "@/lib/markets";
import { ORACLE_MARKETS } from "@/lib/oracle";
import {
  fetchIndexerOracleQueue,
  INDEXER_ORACLE_QUEUE_PAGE_SIZE,
  indexerEnabled,
  type IndexerOracleQueueItem,
} from "@/lib/indexer";
import {
  formatMaturityTs,
  ORACLE_QUEUE_FILTERS,
  oracleQueueStatusClass,
  oracleQueueStatusLabel,
  type OracleQueueFilter,
} from "@/lib/oracle-queue";
import { VirtualScrollList } from "@/components/VirtualScrollList";

const KIND_LABELS: Record<string, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

/** Fixed row height for virtual scroll (includes gap). */
const ORACLE_MARKET_ROW_HEIGHT = 100;

type Props = {
  poolId: string;
  onSelectPool: (poolId: string) => void;
};

function seedFallbackItems(query: string): IndexerOracleQueueItem[] {
  const q = query.trim().toLowerCase();
  return ORACLE_MARKETS.filter((m) => m.poolId)
    .filter((m) => {
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.poolId.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    })
    .map((m) => ({
      pool_id: m.poolId,
      slug: m.id,
      title: m.title,
      description: "",
      kind: m.kind,
      maturity_ts: "0",
      resolved: false,
      feed_id: null,
      feed_status: null,
      active_assertion_id: null,
      open_case_id: null,
      queue_status: "pending_propose" as const,
    }));
}

function mergeQueueItems(
  prev: IndexerOracleQueueItem[],
  next: IndexerOracleQueueItem[],
): IndexerOracleQueueItem[] {
  const seen = new Set(prev.map((i) => i.pool_id));
  const merged = [...prev];
  for (const item of next) {
    if (seen.has(item.pool_id)) continue;
    seen.add(item.pool_id);
    merged.push(item);
  }
  return merged;
}

function OracleMarketRow({
  item,
  active,
  onSelect,
}: {
  item: IndexerOracleQueueItem;
  active: boolean;
  onSelect: () => void;
}) {
  const kind = item.kind as MarketKind;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={`prophet-market-item oracle-market-row${active ? " active" : ""}`}
      onClick={onSelect}
    >
      <div className="prophet-market-item-head">
        <span className={`badge badge-${kind}`}>
          {KIND_LABELS[kind] ?? item.kind}
        </span>
        <span className={oracleQueueStatusClass(item.queue_status)}>
          {oracleQueueStatusLabel(item.queue_status)}
        </span>
      </div>
      <strong className="oracle-market-row-title">{item.title}</strong>
      {item.description && (
        <p className="oracle-market-row-desc">{item.description}</p>
      )}
      <div className="prophet-market-item-foot">
        <span>到期 {formatMaturityTs(item.maturity_ts)}</span>
        <code className="mono">{item.pool_id.slice(0, 10)}…</code>
      </div>
    </button>
  );
}

export function OracleMarketPicker({ poolId, onSelectPool }: Props) {
  const [queueFilter, setQueueFilter] = useState<OracleQueueFilter>("actionable");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<IndexerOracleQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!indexerEnabled()) {
        const fallback = seedFallbackItems(debouncedQuery);
        setItems(fallback);
        setTotal(fallback.length);
        setHasMore(false);
        setNextOffset(fallback.length);
        return;
      }

      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const searching = debouncedQuery.length >= 2;
        const { items: rows, pagination } = await fetchIndexerOracleQueue({
          status: searching ? "all" : queueFilter,
          q: searching ? debouncedQuery : undefined,
          limit: INDEXER_ORACLE_QUEUE_PAGE_SIZE,
          offset,
        });
        setItems((prev) => (append ? mergeQueueItems(prev, rows) : rows));
        setTotal(pagination?.total ?? rows.length);
        setHasMore(pagination?.has_more ?? false);
        setNextOffset(offset + rows.length);
      } catch {
        setLoadError("加载市场列表失败");
        if (!append) {
          const fallback = seedFallbackItems(debouncedQuery);
          setItems(fallback);
          setTotal(fallback.length);
          setHasMore(false);
          setNextOffset(fallback.length);
        }
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [debouncedQuery, queueFilter],
  );

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !indexerEnabled()) return;
    void loadPage(nextOffset, true);
  }, [loading, loadingMore, hasMore, nextOffset, loadPage]);

  const emptyMessage = debouncedQuery
    ? "无匹配市场，请调整搜索词或使用 Pool ID 直达"
    : "暂无待办市场（未到期或已全部结算）";

  return (
    <div className="prophet-market-picker oracle-market-picker">
      <div className="prophet-market-picker-toolbar">
        <div className="prophet-kind-tabs" role="tablist" aria-label="Oracle 待办筛选">
          {ORACLE_QUEUE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={queueFilter === f.value}
              className={queueFilter === f.value ? "active" : undefined}
              disabled={debouncedQuery.length >= 2}
              onClick={() => setQueueFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="prophet-market-search"
          placeholder="搜索标题、slug 或 Pool ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索市场"
        />
      </div>

      <p className="hint prophet-market-picker-meta">
        {!indexerEnabled() ? (
          "Indexer 未配置，显示种子市场本地列表"
        ) : loading && items.length === 0 ? (
          "正在加载待办市场…"
        ) : (
          <>
            {indexerEnabled() && total > 0
              ? `共 ${total} 个 · 已加载 ${items.length} 个`
              : `结果 ${items.length} 个`}
            {debouncedQuery.length >= 2 && ` · 搜索「${debouncedQuery}」`}
            {loadingMore && " · 加载更多…"}
            {loadError && ` · ${loadError}`}
          </>
        )}
      </p>

      <VirtualScrollList
        items={items}
        itemKey={(item) => item.pool_id}
        itemHeight={ORACLE_MARKET_ROW_HEIGHT}
        height={360}
        className="oracle-virtual-list prophet-market-list"
        onNearEnd={loadMore}
        empty={
          !loading ? (
            <div className="prophet-market-empty">{emptyMessage}</div>
          ) : (
            <div className="prophet-market-empty">加载中…</div>
          )
        }
        renderItem={(item, _index, { active }) => (
          <OracleMarketRow
            item={item}
            active={active || item.pool_id === poolId}
            onSelect={() => onSelectPool(item.pool_id)}
          />
        )}
        scrollToKey={poolId || null}
        selectedKey={poolId || null}
        keyboardNav
        onSelectKey={onSelectPool}
        aria-label="Oracle 市场待办"
      />
      <p className="hint oracle-list-kbd-hint">
        列表聚焦后可用 ↑↓ 浏览、Enter 选中；滚到底自动加载更多。
      </p>
    </div>
  );
}
