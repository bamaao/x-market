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

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { ADMIN_CAP_ID, GLOBAL_CONFIG_ID, PACKAGE_ID } from "@/lib/markets";
import {
  VOID_REASON,
  appendEmergencyVoidMarket,
} from "@/lib/emergency-cancel";
import { parseMoveObjectFields, parsePoolView, STATUS_VOIDED } from "@/lib/position-display";
import { useT } from "@/i18n/context";
import { formatCaughtError } from "@/i18n/core";

export default function AdminPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const t = useT();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState("");
  const [adminCapId, setAdminCapId] = useState(ADMIN_CAP_ID);
  const [reasonCode, setReasonCode] = useState(String(VOID_REASON.MATCH_CANCELLED));
  const [poolStatus, setPoolStatus] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const inspectPool = async () => {
    const id = poolId.trim();
    if (!id) {
      setPoolStatus(t("admin.fillPoolId"));
      return;
    }
    try {
      const obj = await client.getObject({ id, options: { showContent: true } });
      const fields = parseMoveObjectFields(obj.data?.content);
      const pool = parsePoolView(id, fields);
      if (!pool) {
        setPoolStatus(t("admin.poolNotFound"));
        return;
      }
      if (pool.status === STATUS_VOIDED) {
        setPoolStatus(t("admin.poolAlreadyVoided"));
      } else if (pool.resolved) {
        setPoolStatus(t("admin.poolAlreadySettled"));
      } else {
        setPoolStatus(
          t("admin.poolReady", {
            status: String(pool.status),
            paused: pool.paused ? t("common.yes") : t("common.no"),
          }),
        );
      }
    } catch (e) {
      setPoolStatus(formatCaughtError(e, t));
    }
  };

  const voidMarket = () => {
    const pid = poolId.trim();
    const cap = adminCapId.trim();
    if (!pid || !cap) {
      setMsg(t("admin.missingIds"));
      return;
    }
    if (!GLOBAL_CONFIG_ID) {
      setMsg(t("admin.missingGlobalConfig"));
      return;
    }
    const reason = Number(reasonCode);
    if (!Number.isFinite(reason) || reason <= 0) {
      setMsg(t("admin.invalidReason"));
      return;
    }
    const tx = new Transaction();
    appendEmergencyVoidMarket(tx, cap, pid, reason);
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setMsg(t("admin.voidSuccess", { digest: r.digest?.slice(0, 18) ?? "" }));
          void inspectPool();
        },
        onError: (e) => setMsg(formatCaughtError(e, t)),
      },
    );
  };

  return (
    <>
      <h1>{t("admin.title")}</h1>
      <p className="sub">{t("admin.subtitle")}</p>

      {!account && <p className="hint">{t("admin.connectHint")}</p>}
      {!GLOBAL_CONFIG_ID && (
        <p className="hint warn">{t("admin.missingGlobalConfig")}</p>
      )}
      {PACKAGE_ID === "0x0" && (
        <p className="hint warn">{t("admin.missingPackage")}</p>
      )}

      <section className="card admin-form">
        <h2>{t("admin.voidSection")}</h2>
        <p className="hint">{t("admin.voidHint")}</p>

        <label className="field">
          <span>{t("common.poolId")}</span>
          <input
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            placeholder="0x…"
            className="mono"
          />
        </label>

        <label className="field">
          <span>{t("admin.adminCapId")}</span>
          <input
            value={adminCapId}
            onChange={(e) => setAdminCapId(e.target.value)}
            placeholder="0x…"
            className="mono"
          />
        </label>

        <label className="field">
          <span>{t("admin.reasonCode")}</span>
          <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            <option value={String(VOID_REASON.MATCH_CANCELLED)}>
              {t("admin.reason.matchCancelled")}
            </option>
            <option value={String(VOID_REASON.MATCH_POSTPONED)}>
              {t("admin.reason.matchPostponed")}
            </option>
            <option value={String(VOID_REASON.FORCE_MAJEURE)}>
              {t("admin.reason.forceMajeure")}
            </option>
            <option value={String(VOID_REASON.OTHER)}>
              {t("admin.reason.other")}
            </option>
          </select>
        </label>

        <div className="row">
          <button type="button" className="secondary" onClick={() => void inspectPool()}>
            {t("admin.inspectPool")}
          </button>
          <button
            type="button"
            disabled={isPending || !account}
            onClick={() => void voidMarket()}
          >
            {isPending ? t("admin.voiding") : t("admin.voidMarket")}
          </button>
        </div>

        {poolStatus && <p className="hint">{poolStatus}</p>}
        {msg && <p className="hint">{msg}</p>}
      </section>

      <section className="card">
        <h2>{t("admin.afterVoidTitle")}</h2>
        <ul className="hint-list">
          <li>{t("admin.afterVoidPositions")}</li>
          <li>{t("admin.afterVoidLp")}</li>
        </ul>
      </section>
    </>
  );
}
