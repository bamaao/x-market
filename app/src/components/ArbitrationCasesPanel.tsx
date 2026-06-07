"use client";

import { useEffect, useState } from "react";
import {
  fetchIndexerArbitrationCases,
  indexerEnabled,
  type IndexerArbitrationCase,
} from "@/lib/indexer";

export function ArbitrationCasesPanel() {
  const [cases, setCases] = useState<IndexerArbitrationCase[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!indexerEnabled()) return;
    setLoading(true);
    void fetchIndexerArbitrationCases().then((rows) => {
      setCases(rows);
      setLoading(false);
    });
  }, []);

  if (!indexerEnabled()) return null;

  return (
    <div className="card" style={{ marginTop: "1.5rem" }}>
      <h2>争议案件（Indexer）</h2>
      <p className="hint">来自链上 ArbitrationCaseOpened 事件 + 对象刷新</p>
      {loading && <p className="hint">加载中…</p>}
      {!loading && cases.length === 0 && (
        <p className="hint">暂无争议案件</p>
      )}
      {!loading && cases.length > 0 && (
        <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--muted)", textAlign: "left" }}>
              <th>Case</th>
              <th>Pool</th>
              <th>Adapter</th>
              <th>Status</th>
              <th>Proposer</th>
              <th>Disputer</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.case_id}>
                <td style={{ padding: "0.25rem 0" }}>{c.case_id.slice(0, 10)}…</td>
                <td>{c.pool_id.slice(0, 10)}…</td>
                <td>{c.arbitration_adapter === "uma_dvm" ? "UMA DVM" : "Builtin"}</td>
                <td>{c.status === 0 ? "Open" : "Executed"}</td>
                <td>{c.proposer.slice(0, 8)}…</td>
                <td>{c.disputer.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
