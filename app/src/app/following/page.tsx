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
          setError(e instanceof Error ? e.message : "加载关注列表失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account?.address]);

  return (
    <div>
      <PageHeader
        title="我的关注"
        subtitle="Indexer 存储的关注关系；战绩仍以链上 ProphetStats 为准。"
      />

      {!indexerEnabled() && (
        <div className="card">
          <p>
            请配置 <code>NEXT_PUBLIC_INDEXER_URL</code> 后使用关注功能。
          </p>
        </div>
      )}

      {!account && indexerEnabled() && (
        <div className="card">
          <p className="hint">连接钱包后查看你关注的预言家。</p>
        </div>
      )}

      {account && indexerEnabled() && (
        <div className="card">
          <h2>关注列表</h2>
          {loading ? (
            <p className="hint">加载中…</p>
          ) : error ? (
            <p className="hint" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="hint">
              尚未关注任何预言家。前往{" "}
              <Link href="/leaderboard">排行榜</Link> 发现并关注。
            </p>
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>预言家</th>
                  <th>排名</th>
                  <th>胜/负</th>
                  <th>胜率</th>
                  <th>Score</th>
                  <th>付费</th>
                  <th>关注于</th>
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
          ← 排行榜
        </Link>
      </div>
    </div>
  );
}
