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
  ORACLE_QUEUE_FILTERS,
  oracleQueueStatusClass,
  type OracleQueueFilter,
  type OracleQueueStatus,
} from "@/lib/oracle-queue";
import { localizedFormatUnixTs, localizedOracleQueueFilter, localizedOracleQueueStatus } from "@/i18n/domain";
import { useI18n, useT } from "@/i18n/context";
import type { Locale } from "@/i18n/types";
import type { Translator } from "@/i18n/core";
import { VirtualScrollList } from "@/components/VirtualScrollList";

const KIND_LABELS: Record<string, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

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

function formatMaturityTs(ts: string | number, locale: Locale): string {
  const n = Number(ts);
  if (!n) return "—";
  return localizedFormatUnixTs(n, locale);
}

function OracleMarketRow({
  item,
  active,
  onSelect,
  t,
  locale,
}: {
  item: IndexerOracleQueueItem;
  active: boolean;
  onSelect: () => void;
  t: Translator;
  locale: Locale;
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
        <span className={oracleQueueStatusClass(item.queue_status as OracleQueueStatus)}>
          {localizedOracleQueueStatus(item.queue_status as OracleQueueStatus, t)}
        </span>
      </div>
      <strong className="oracle-market-row-title">{item.title}</strong>
      {item.description && (
        <p className="oracle-market-row-desc">{item.description}</p>
      )}
      <div className="prophet-market-item-foot">
        <span>
          {t("oracle.maturityLabel")} {formatMaturityTs(item.maturity_ts, locale)}
        </span>
        <code className="mono">{item.pool_id.slice(0, 10)}…</code>
      </div>
    </button>
  );
}

export function OracleMarketPicker({ poolId, onSelectPool }: Props) {
  const t = useT();
  const { locale } = useI18n();
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
        setLoadError(t("oracle.pickerLoadFailed"));
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
    [debouncedQuery, queueFilter, t],
  );

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !indexerEnabled()) return;
    void loadPage(nextOffset, true);
  }, [loading, loadingMore, hasMore, nextOffset, loadPage]);

  const emptyMessage = debouncedQuery
    ? t("oracle.pickerEmptySearch")
    : t("oracle.pickerEmpty");

  return (
    <div className="prophet-market-picker oracle-market-picker">
      <div className="prophet-market-picker-toolbar">
        <div className="prophet-kind-tabs" role="tablist" aria-label={t("oracle.pickerFilterAria")}>
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
              {localizedOracleQueueFilter(f.value, t)}
            </button>
          ))}
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
        {!indexerEnabled() ? (
          t("oracle.pickerIndexerFallback")
        ) : loading && items.length === 0 ? (
          t("oracle.pickerLoading")
        ) : (
          <>
            {indexerEnabled() && total > 0
              ? t("oracle.pickerMeta", { total, loaded: items.length })
              : t("oracle.pickerResults", { count: items.length })}
            {debouncedQuery.length >= 2 &&
              t("oracle.pickerSearching", { q: debouncedQuery })}
            {loadingMore && t("oracle.pickerLoadingMore")}
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
            <div className="prophet-market-empty">{t("common.loading")}</div>
          )
        }
        renderItem={(item, _index, { active }) => (
          <OracleMarketRow
            item={item}
            active={active || item.pool_id === poolId}
            onSelect={() => onSelectPool(item.pool_id)}
            t={t}
            locale={locale}
          />
        )}
        scrollToKey={poolId || null}
        selectedKey={poolId || null}
        keyboardNav
        onSelectKey={onSelectPool}
        aria-label={t("oracle.pickerAria")}
      />
      <p className="hint oracle-list-kbd-hint">{t("prophet.pickerKbdHint")}</p>
    </div>
  );
}
