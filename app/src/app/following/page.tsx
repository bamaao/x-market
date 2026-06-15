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

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  fetchIndexerFollowing,
  indexerEnabled,
  type IndexerFollowRow,
} from "@/lib/indexer";
import {
  formatAccuracyPercent,
  formatScorePercent,
  isPaidUnlockEligible,
  prophetProfilePath,
  shortAddress,
  type ProphetStatsView,
} from "@/lib/prophet";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n/context";

function followRowToStats(row: IndexerFollowRow): ProphetStatsView | null {
  if (row.wins == null || row.losses == null || row.score_bps == null) return null;
  return {
    prophet: row.prophet,
    wins: row.wins,
    losses: row.losses,
    cheats: row.cheats ?? 0,
    currentStreak: row.current_streak ?? 0,
    maxStreak: row.max_streak ?? 0,
    totalAudited: row.total_audited ?? 0,
    totalUnlockRevenue: BigInt(row.total_unlock_revenue ?? "0"),
    scoreBps: row.score_bps,
  };
}

function formatFollowedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString();
}

export default function FollowingPage() {
  const t = useT();
  const account = useCurrentAccount();
  const [rows, setRows] = useState<IndexerFollowRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.address || !indexerEnabled()) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchIndexerFollowing(account.address)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setRows([]);
          setError(e instanceof Error ? e.message : t("following.errLoad"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account?.address, t]);

  return (
    <div>
      <PageHeader
        title={t("following.title")}
        subtitle={t("following.subtitle")}
      />

      {!indexerEnabled() && (
        <div className="card">
          <p>{t("following.indexerRequired")}</p>
        </div>
      )}

      {!account && indexerEnabled() && (
        <div className="card">
          <p className="hint">{t("following.connectHint")}</p>
        </div>
      )}

      {account && indexerEnabled() && (
        <div className="card">
          <h2>{t("following.listTitle")}</h2>
          {loading ? (
            <p className="hint">{t("common.loading")}</p>
          ) : error ? (
            <p className="hint" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="hint">
              {t("following.empty")}{" "}
              <Link href="/leaderboard">{t("following.emptyLeaderboard")}</Link>.
            </p>
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>{t("following.colProphet")}</th>
                  <th>{t("following.colRank")}</th>
                  <th>{t("following.colWl")}</th>
                  <th>{t("following.colWinRate")}</th>
                  <th>{t("following.colScore")}</th>
                  <th>{t("following.colPaid")}</th>
                  <th>{t("following.colFollowedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const stats = followRowToStats(row);
                  return (
                    <tr key={row.prophet}>
                      <td>
                        <Link href={prophetProfilePath(row.prophet)}>
                          <code>{shortAddress(row.prophet)}</code>
                        </Link>
                      </td>
                      <td>{row.rank != null ? `#${row.rank}` : "—"}</td>
                      <td>
                        {stats
                          ? `${stats.wins}/${stats.losses}`
                          : "—"}
                      </td>
                      <td>{stats ? formatAccuracyPercent(stats) : "—"}</td>
                      <td>
                        {stats ? formatScorePercent(stats.scoreBps) : "—"}
                      </td>
                      <td>
                        {stats
                          ? isPaidUnlockEligible(stats)
                            ? "✓"
                            : "—"
                          : row.paid_unlock_eligible
                            ? "✓"
                            : "—"}
                      </td>
                      <td>{formatFollowedAt(row.followed_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </div>
      )}

      <div className="btn-row">
        <Link href="/leaderboard" className="hero-link secondary">
          {t("following.backLeaderboard")}
        </Link>
      </div>
    </div>
  );
}
