"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  fetchIndexerBuyerRoi,
  fetchIndexerBuyerRoiSummary,
  indexerEnabled,
  type IndexerBuyerRoi,
  type IndexerBuyerRoiSummary,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n/context";

function formatUsdc(mist: string | number | null | undefined): string {
  if (mist == null || mist === "") return "—";
  const n = Number(mist) / 1e6;
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(4)} USDC`;
}

function roiLabel(bps: number | string | null | undefined): string {
  if (bps == null || bps === "") return "—";
  const n = Number(bps);
  if (!Number.isFinite(n)) return "—";
  return `${(n / 100).toFixed(2)}%`;
}

function shortId(value: string | null | undefined, len = 10): string {
  if (!value) return "—";
  return value.length > len ? `${value.slice(0, len)}…` : value;
}

export default function RoiPage() {
  const t = useT();
  const account = useCurrentAccount();
  const [summary, setSummary] = useState<IndexerBuyerRoiSummary | null>(null);
  const [rows, setRows] = useState<IndexerBuyerRoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.address || !indexerEnabled()) {
      setSummary(null);
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchIndexerBuyerRoiSummary(account.address),
      fetchIndexerBuyerRoi(account.address),
    ])
      .then(([s, r]) => {
        if (cancelled) return;
        setSummary(s);
        setRows(r);
      })
      .catch((e) => {
        if (cancelled) return;
        setSummary(null);
        setRows([]);
        setError(e instanceof Error ? e.message : t("roi.errLoad"));
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
        title={t("roi.title")}
        subtitle={
          <>
            {t("roi.subtitle")}
          </>
        }
      />

      {!indexerEnabled() && (
        <div className="card">
          <p>{t("roi.indexerRequired")}</p>
        </div>
      )}

      {!account && indexerEnabled() && (
        <div className="card">
          <p>{t("roi.connectHint")}</p>
        </div>
      )}

      {account && indexerEnabled() && (
        <>
          {error && (
            <div className="card">
              <p className="hint oracle-pool-error">{error}</p>
              <p className="hint">{t("roi.migrationHint")}</p>
            </div>
          )}

          <div className="card">
            <h2>{t("roi.summaryTitle")}</h2>
            {loading ? (
              <p className="hint">{t("common.loading")}</p>
            ) : summary ? (
              <dl className="meta">
                <dt>{t("roi.totalCost")}</dt>
                <dd>{formatUsdc(summary.total_unlock_cost)}</dd>
                <dt>{t("roi.positionCount")}</dt>
                <dd>{summary.total_positions ?? 0}</dd>
                <dt>{t("roi.wlcp")}</dt>
                <dd>
                  {summary.wins ?? 0} / {summary.losses ?? 0} / {summary.cheats ?? 0} /{" "}
                  {summary.pending ?? 0}
                </dd>
                <dt>{t("roi.avgRoi")}</dt>
                <dd>{roiLabel(summary.aggregate_roi_bps)}</dd>
              </dl>
            ) : (
              <p className="hint">
                {t("roi.empty")}{" "}
                <Link href="/prophet">Prophet</Link>.
              </p>
            )}
          </div>

          <div className="card">
            <h2>{t("roi.detailTitle")}</h2>
            {loading ? (
              <p className="hint">{t("common.loading")}</p>
            ) : rows.length === 0 ? (
              <p className="hint">{t("roi.noDetail")}</p>
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>{t("roi.colProphecy")}</th>
                    <th>{t("roi.colProphet")}</th>
                    <th>{t("roi.colCost")}</th>
                    <th>{t("roi.colOutcome")}</th>
                    <th>{t("roi.colRoi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.prophecy_id ? `${r.buyer}-${r.prophecy_id}` : `row-${i}`}>
                      <td>
                        <code>{shortId(r.prophecy_id)}</code>
                      </td>
                      <td>
                        <code>{shortId(r.prophet, 8)}</code>
                      </td>
                      <td>{formatUsdc(r.unlock_cost)}</td>
                      <td>{r.outcome || "—"}</td>
                      <td>{roiLabel(r.roi_bps)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </div>
        </>
      )}
    </div>
  );
}
