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
import { useParams } from "next/navigation";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import {
  MIN_AUDITED_FOR_PAID,
  MIN_SCORE_BPS_FOR_PAID,
  PROPHET_REGISTRY_ID,
  discoverPropheciesByProphet,
  fetchProphetStats,
  fetchProphecy,
  formatAccuracyPercent,
  formatScorePercent,
  formatUsdcBaseUnits,
  isPaidUnlockEligible,
  isPublicProphecy,
  isValidSuiAddress,
  normalizeSuiAddress,
  shortAddress,
  type LeaderboardEntry,
  type ProphecyView,
} from "@/lib/prophet";
import {
  fetchIndexerProphetHistory,
  fetchIndexerProphetStats,
  fetchIndexerProphecies,
  indexerEnabled,
  type IndexerProphetStatsHistoryPoint,
  type IndexerProphecyRow,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { FollowButton } from "@/components/FollowButton";
import { PageHeader } from "@/components/PageHeader";
import {
  localizedPaidUnlockEligibilityHint,
  localizedProphecyStatus,
} from "@/i18n/domain";
import { useT } from "@/i18n/context";

function indexerStatsToEntry(
  stats: NonNullable<Awaited<ReturnType<typeof fetchIndexerProphetStats>>>,
): LeaderboardEntry {
  return {
    prophet: stats.prophet,
    wins: stats.wins,
    losses: stats.losses,
    cheats: stats.cheats,
    currentStreak: stats.current_streak,
    maxStreak: stats.max_streak,
    totalAudited: stats.total_audited,
    totalUnlockRevenue: BigInt(stats.total_unlock_revenue),
    scoreBps: stats.score_bps,
    rank: stats.rank,
  };
}

function chainStatsToEntry(
  stats: NonNullable<Awaited<ReturnType<typeof fetchProphetStats>>>,
): LeaderboardEntry {
  return { ...stats, rank: 0 };
}

function formatTimestamp(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return new Date(value * 1000).toLocaleString();
  }
  const asNum = Number(value);
  if (Number.isFinite(asNum) && asNum > 1_000_000_000) {
    return new Date(asNum * 1000).toLocaleString();
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return new Date(parsed).toLocaleString();
  return String(value);
}

function prophecyRowFromChain(p: ProphecyView): IndexerProphecyRow {
  return {
    prophecy_id: p.id,
    pool_id: p.marketId,
    prophet: p.prophet,
    lock_time: p.lockTime,
    unlock_price: p.unlockPrice.toString(),
    predicted_value: String(p.predictedValue),
    status: p.status,
    is_public: isPublicProphecy(p),
    unlock_count: p.unlockCount,
    committed_at: null,
  };
}

export default function ProphetProfilePage() {
  const t = useT();
  const params = useParams<{ address: string }>();
  const account = useCurrentAccount();
  const client = useSuiClient();

  const prophetAddress = useMemo(() => {
    const raw = params?.address ?? "";
    try {
      return normalizeSuiAddress(decodeURIComponent(raw));
    } catch {
      return normalizeSuiAddress(raw);
    }
  }, [params?.address]);

  const addressValid = isValidSuiAddress(prophetAddress);
  const isSelf = account?.address
    ? normalizeSuiAddress(account.address) === prophetAddress
    : false;

  const [stats, setStats] = useState<LeaderboardEntry | null>(null);
  const [history, setHistory] = useState<IndexerProphetStatsHistoryPoint[]>([]);
  const [prophecies, setProphecies] = useState<IndexerProphecyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsSource, setStatsSource] = useState<"indexer" | "chain" | null>(
    null,
  );

  useEffect(() => {
    if (!addressValid) {
      setStats(null);
      setHistory([]);
      setProphecies([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let loadedStats: LeaderboardEntry | null = null;
      let source: "indexer" | "chain" | null = null;
      let loadedProphecies: IndexerProphecyRow[] = [];
      let loadedHistory: IndexerProphetStatsHistoryPoint[] = [];

      if (indexerEnabled()) {
        const [indexed, hist, rows] = await Promise.all([
          fetchIndexerProphetStats(prophetAddress),
          fetchIndexerProphetHistory(prophetAddress, 30),
          fetchIndexerProphecies({ prophet: prophetAddress, limit: 50 }),
        ]);
        loadedHistory = hist;
        loadedProphecies = rows;
        if (indexed) {
          loadedStats = indexerStatsToEntry(indexed);
          source = "indexer";
        }
      }

      if (!loadedStats && PROPHET_REGISTRY_ID) {
        const chainStats = await fetchProphetStats(
          client,
          PROPHET_REGISTRY_ID,
          prophetAddress,
        );
        if (chainStats) {
          loadedStats = chainStatsToEntry(chainStats);
          source = "chain";
        }
      }

      if (loadedProphecies.length === 0) {
        const ids = await discoverPropheciesByProphet(client, prophetAddress, 50);
        const views = await Promise.all(ids.map((id) => fetchProphecy(client, id)));
        loadedProphecies = views
          .filter((p): p is ProphecyView => p !== null)
          .map(prophecyRowFromChain);
      }

      if (!cancelled) {
        setStats(loadedStats);
        setStatsSource(source);
        setHistory(loadedHistory);
        setProphecies(loadedProphecies);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [addressValid, client, prophetAddress]);

  const unlockPriceLabel = (unlockPrice: string) => {
    const n = BigInt(unlockPrice || "0");
    if (n === 0n) return t("prophetProfile.free");
    return formatUsdcBaseUnits(n);
  };

  if (!addressValid) {
    return (
      <div>
        <PageHeader
          title={t("prophetProfile.invalidTitle")}
          subtitle={t("prophetProfile.invalidSubtitle")}
        />
        <div className="card">
          <p>{t("prophetProfile.invalidHint")}</p>
          <Link href="/leaderboard" className="hero-link secondary">
            {t("prophetProfile.backLeaderboard")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isSelf ? t("prophetProfile.titleSelf") : t("prophetProfile.title")}
        subtitle={
          <>
            {t("prophetProfile.subtitle")}{" "}
            <code className="mono">{shortAddress(prophetAddress, 8, 6)}</code>
          </>
        }
      >
        <p className="mono" style={{ fontSize: "0.75rem", margin: "0.5rem 0 0" }}>
          {prophetAddress}
        </p>
      </PageHeader>

      <div className="btn-row" style={{ marginBottom: "1rem" }}>
        <Link href="/leaderboard" className="hero-link secondary">
          {t("prophetProfile.backLeaderboard")}
        </Link>
        {isSelf ? (
          <Link href="/prophet" className="hero-link">
            {t("prophetProfile.manageProphecies")}
          </Link>
        ) : (
          <Link href="/prophet" className="hero-link">
            {t("prophetProfile.unlockProphecies")}
          </Link>
        )}
        {isSelf && (
          <Link href="/following" className="hero-link secondary">
            {t("prophetProfile.myFollowing")}
          </Link>
        )}
      </div>

      {!isSelf && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <FollowButton prophetAddress={prophetAddress} />
        </div>
      )}

      <div className="card">
        <h2>{t("prophetProfile.statsSummary")}</h2>
        {loading ? (
          <p className="hint">{t("prophetProfile.loadingStats")}</p>
        ) : !stats ? (
          <p className="hint">
            {t("prophetProfile.noStats")}
            {isSelf && <> {t("prophetProfile.noStatsSelf")}</>}
          </p>
        ) : (
          <>
            <dl className="meta">
              <dt>{t("prophetProfile.rank")}</dt>
              <dd>{stats.rank > 0 ? `#${stats.rank}` : t("common.dash")}</dd>
              <dt>{t("prophetProfile.wlCheats")}</dt>
              <dd>
                {stats.wins} / {stats.losses} / {stats.cheats}
              </dd>
              <dt>{t("leaderboard.winRate")}</dt>
              <dd>{formatAccuracyPercent(stats)}</dd>
              <dt>{t("prophetProfile.audited")}</dt>
              <dd>{stats.totalAudited}</dd>
              <dt>{t("prophetProfile.streak")}</dt>
              <dd>
                {stats.currentStreak} ({stats.maxStreak})
              </dd>
              <dt>Prophet Score</dt>
              <dd>{formatScorePercent(stats.scoreBps)} / 100</dd>
              <dt>{t("prophetProfile.unlockRevenue")}</dt>
              <dd>{formatUsdcBaseUnits(stats.totalUnlockRevenue)}</dd>
              <dt>{t("prophetProfile.paidUnlock")}</dt>
              <dd>
                {isPaidUnlockEligible(stats)
                  ? t("prophetProfile.paidEnabled")
                  : t("prophetProfile.paidDisabled")}
                {!isPaidUnlockEligible(stats) && (
                  <span className="hint">
                    {" "}
                    — {localizedPaidUnlockEligibilityHint(stats, t)}
                  </span>
                )}
              </dd>
              <dt>{t("prophetProfile.dataSource")}</dt>
              <dd>
                {statsSource === "indexer"
                  ? t("prophetProfile.sourceIndexer")
                  : t("prophetProfile.sourceChain")}
              </dd>
            </dl>
            <p className="hint">
              {t("prophetProfile.paidThreshold", {
                min: MIN_AUDITED_FOR_PAID,
                score: MIN_SCORE_BPS_FOR_PAID / 100,
              })}
            </p>
          </>
        )}
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2>{t("prophetProfile.scoreHistory")}</h2>
          <p className="hint">
            {t("prophetProfile.scoreHistoryHint", { count: history.length })}
          </p>
          <DataTable>
            <thead>
              <tr>
                <th>{t("prophetProfile.colTime")}</th>
                <th>Score</th>
                <th>{t("prophetProfile.colRank")}</th>
                <th>{t("prophetProfile.colWl")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((point) => (
                <tr key={point.snapshot_at}>
                  <td>{formatTimestamp(point.snapshot_at)}</td>
                  <td>{formatScorePercent(point.score_bps)}</td>
                  <td>{point.rank != null ? `#${point.rank}` : t("common.dash")}</td>
                  <td>
                    {point.wins}/{point.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      <div className="card">
        <h2>{t("prophetProfile.prophecies")}</h2>
        {loading ? (
          <p className="hint">{t("prophetProfile.loadingProphecies")}</p>
        ) : prophecies.length === 0 ? (
          <p className="hint">{t("prophetProfile.noProphecies")}</p>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>{t("prophetProfile.colProphecyId")}</th>
                <th>{t("prophetProfile.colMarket")}</th>
                <th>{t("prophetProfile.colPredicted")}</th>
                <th>{t("prophetProfile.colUnlockPrice")}</th>
                <th>{t("prophetProfile.colStatus")}</th>
                <th>{t("prophetProfile.colUnlockCount")}</th>
                <th>{t("prophetProfile.colLockTime")}</th>
              </tr>
            </thead>
            <tbody>
              {prophecies.map((row) => (
                <tr key={row.prophecy_id}>
                  <td>
                    <code>{shortAddress(row.prophecy_id, 8, 6)}</code>
                  </td>
                  <td>
                    <Link href={`/markets/${row.pool_id}`}>
                      <code>{shortAddress(row.pool_id, 8, 4)}</code>
                    </Link>
                  </td>
                  <td>{row.predicted_value ?? t("common.dash")}</td>
                  <td>{unlockPriceLabel(row.unlock_price)}</td>
                  <td>{localizedProphecyStatus(row.status, t)}</td>
                  <td>{row.unlock_count}</td>
                  <td>{formatTimestamp(row.lock_time)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <p className="hint" style={{ marginTop: "1rem" }}>
          {t("prophetProfile.footerHint")}{" "}
          <Link href="/prophet">Prophet</Link>
        </p>
      </div>
    </div>
  );
}
