"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import {
  MIN_AUDITED_FOR_PAID,
  MIN_SCORE_BPS_FOR_PAID,
  PROPHET_REGISTRY_ID,
  fetchLeaderboard,
  formatAccuracyPercent,
  formatScorePercent,
  formatUsdcBaseUnits,
  isPaidUnlockEligible,
  prophetProfilePath,
  shortAddress,
  type LeaderboardEntry,
} from "@/lib/prophet";
import {
  fetchIndexerLeaderboard,
  indexerEnabled,
  type IndexerProphetStats,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { localizedPaidUnlockEligibilityHint } from "@/i18n/domain";
import { useT } from "@/i18n/context";

export default function LeaderboardPage() {
  const t = useT();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const load = async () => {
      if (indexerEnabled()) {
        const indexed = await fetchIndexerLeaderboard(50);
        if (indexed.length) {
          setRows(
            indexed.map((r: IndexerProphetStats) => ({
              prophet: r.prophet,
              wins: r.wins,
              losses: r.losses,
              cheats: r.cheats,
              currentStreak: r.current_streak,
              maxStreak: r.max_streak,
              totalAudited: r.total_audited,
              totalUnlockRevenue: BigInt(r.total_unlock_revenue),
              scoreBps: r.score_bps,
              rank: r.rank,
            })),
          );
          setLoading(false);
          return;
        }
      }
      if (!PROPHET_REGISTRY_ID) {
        setLoading(false);
        return;
      }
      const data = await fetchLeaderboard(client, PROPHET_REGISTRY_ID, 50);
      setRows(data);
      setLoading(false);
    };
    void load();
  }, [client]);

  const myRow = rows.find((r) => r.prophet === account?.address);

  return (
    <div>
      <PageHeader
        title={t("leaderboard.title")}
        subtitle={t("leaderboard.subtitle")}
      />

      {!PROPHET_REGISTRY_ID && (
        <div className="card">
          <p>{t("leaderboard.registryRequired")}</p>
        </div>
      )}

      {account && (
        <div className="card">
          <h2>{t("leaderboard.myStats")}</h2>
          {myRow ? (
            <>
              <dl className="meta">
                <dt>{t("leaderboard.rank")}</dt>
                <dd>#{myRow.rank}</dd>
                <dt>{t("leaderboard.wl")}</dt>
                <dd>
                  {myRow.wins} / {myRow.losses}
                </dd>
                <dt>{t("leaderboard.winRate")}</dt>
                <dd>{formatAccuracyPercent(myRow)}</dd>
                <dt>Prophet Score</dt>
                <dd>{formatScorePercent(myRow.scoreBps)} / 100</dd>
                <dt>{t("leaderboard.paidUnlock")}</dt>
                <dd>
                  {isPaidUnlockEligible(myRow) ? t("leaderboard.paidEnabled") : t("leaderboard.paidDisabled")}
                  {!isPaidUnlockEligible(myRow) && (
                    <span className="hint"> — {localizedPaidUnlockEligibilityHint(myRow, t)}</span>
                  )}
                </dd>
              </dl>
              <p style={{ marginTop: "0.75rem" }}>
                <Link href={prophetProfilePath(account.address)} className="hero-link">
                  {t("leaderboard.viewProfile")}
                </Link>
              </p>
            </>
          ) : (
            <p className="hint">
              {t("leaderboard.noStats")}{" "}
              <Link href="/prophet">Prophet</Link>{" "}
              {t("leaderboard.noStatsHint")}
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h2>{t("leaderboard.globalRank")}</h2>
        <p className="hint">
          {t("leaderboard.scoreFormula", {
            minAudited: MIN_AUDITED_FOR_PAID,
            minScore: MIN_SCORE_BPS_FOR_PAID / 100,
          })}
        </p>
        {loading ? (
          <p className="hint">{t("leaderboard.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="hint">{t("leaderboard.empty")}</p>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("leaderboard.colProphet")}</th>
                <th>{t("leaderboard.colWlC")}</th>
                <th>{t("leaderboard.winRate")}</th>
                <th>{t("leaderboard.colStreak")}</th>
                <th>Score</th>
                <th>{t("leaderboard.colRevenue")}</th>
                <th>{t("leaderboard.colPaid")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.prophet}>
                  <td>{row.rank}</td>
                  <td>
                    <Link href={prophetProfilePath(row.prophet)}>
                      <code>{shortAddress(row.prophet)}</code>
                      {account?.address === row.prophet ? t("common.you") : ""}
                    </Link>
                  </td>
                  <td>
                    {row.wins}/{row.losses}/{row.cheats}
                  </td>
                  <td>{formatAccuracyPercent(row)}</td>
                  <td>
                    {row.currentStreak} (max {row.maxStreak})
                  </td>
                  <td>{formatScorePercent(row.scoreBps)}</td>
                  <td>{formatUsdcBaseUnits(row.totalUnlockRevenue)}</td>
                  <td>{isPaidUnlockEligible(row) ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <p className="hint" style={{ marginTop: "1rem" }}>
          {t("leaderboard.indexerHint")}
        </p>
      </div>

      <div className="btn-row">
        <Link href="/prophet" className="card" style={{ padding: "0.75rem 1rem" }}>
          {t("leaderboard.publishLink")}
        </Link>
      </div>

    </div>
  );
}
