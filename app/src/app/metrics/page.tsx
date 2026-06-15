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
import {
  fetchIndexerProphetGmv,
  indexerEnabled,
  type IndexerProphetGmvDay,
  type IndexerProphetGmvTotals,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n/context";

function formatUsdc(mist: string): string {
  return `${(Number(mist) / 1e6).toFixed(2)} USDC`;
}

export default function MetricsPage() {
  const t = useT();
  const [daily, setDaily] = useState<IndexerProphetGmvDay[]>([]);
  const [totals, setTotals] = useState<IndexerProphetGmvTotals | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!indexerEnabled()) return;
    setLoading(true);
    void fetchIndexerProphetGmv(30).then(({ daily: d, totals: tot }) => {
      setDaily(d);
      setTotals(tot);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title={t("metrics.title")}
        subtitle={t("metrics.subtitle")}
      />

      {!indexerEnabled() && (
        <div className="card">
          <p>{t("metrics.indexerRequired")}</p>
        </div>
      )}

      {indexerEnabled() && (
        <div className="card">
          <h2>{t("metrics.summary30d")}</h2>
          {loading ? (
            <p className="hint">{t("common.loading")}</p>
          ) : totals ? (
            <dl className="meta">
              <dt>{t("metrics.unlockGmv")}</dt>
              <dd>{formatUsdc(totals.total_gmv)}</dd>
              <dt>{t("metrics.unlockCount")}</dt>
              <dd>{totals.total_unlocks}</dd>
              <dt>{t("metrics.audited")}</dt>
              <dd>{totals.total_audited}</dd>
            </dl>
          ) : (
            <p className="hint">{t("metrics.noData")}</p>
          )}
        </div>
      )}

      {indexerEnabled() && daily.length > 0 && (
        <div className="card">
          <h2>{t("metrics.dailyTitle")}</h2>
          <DataTable>
            <thead>
              <tr>
                <th>{t("metrics.colDate")}</th>
                <th>{t("metrics.colGmv")}</th>
                <th>{t("metrics.colCount")}</th>
                <th>{t("metrics.colAudit")}</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((row) => (
                <tr key={row.day}>
                  <td>{row.day.slice(0, 10)}</td>
                  <td>{formatUsdc(row.unlock_gmv)}</td>
                  <td>{row.unlock_count}</td>
                  <td>{row.prophecies_audited}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      <div className="btn-row">
        <Link href="/prophet" className="card" style={{ padding: "0.75rem 1rem" }}>
          {t("metrics.prophetHome")}
        </Link>
        <Link href="/leaderboard" className="card" style={{ padding: "0.75rem 1rem" }}>
          {t("metrics.leaderboard")}
        </Link>
      </div>
    </div>
  );
}
