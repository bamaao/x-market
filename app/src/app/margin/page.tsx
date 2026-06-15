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
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "@/lib/markets";
import {
  appendOpenMarginAccount,
  appendRegisterPosition,
  appendUnregisterPosition,
} from "@/lib/margin";
import { formatUsdcBaseUnits } from "@/lib/usdc";
import { useT } from "@/i18n/context";

function parseFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

export default function MarginPage() {
  const t = useT();
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState("");
  const [marginAccountId, setMarginAccountId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const { data, refetch, isPending: loading } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: {
        StructType: `${PACKAGE_ID}::cross_margin::MarginAccount`,
      },
      options: { showContent: true },
    },
    { enabled: !!account?.address && PACKAGE_ID !== "0x0" },
  );

  const runTx = (tx: Transaction, ok: string) => {
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setMsg(`${ok}: ${r.digest?.slice(0, 16)}…`);
          void refetch();
        },
        onError: (e) => setMsg(t("trade.failed", { message: e.message })),
      },
    );
  };

  const openAccount = () => {
    if (!poolId) return setMsg(t("margin.errFillPool"));
    const tx = new Transaction();
    appendOpenMarginAccount(tx, poolId);
    runTx(tx, t("margin.okOpen"));
  };

  const register = () => {
    if (!marginAccountId || !poolId || !positionId) {
      return setMsg(t("margin.errFillAll"));
    }
    const tx = new Transaction();
    appendRegisterPosition(tx, marginAccountId, poolId, positionId);
    runTx(tx, t("margin.okRegister"));
  };

  const unregister = () => {
    if (!marginAccountId || !poolId || !positionId) {
      return setMsg(t("margin.errFillAll"));
    }
    const tx = new Transaction();
    appendUnregisterPosition(tx, marginAccountId, poolId, positionId);
    runTx(tx, t("margin.okUnregister"));
  };

  return (
    <>
      <h1>{t("margin.title")}</h1>
      <p className="sub">{t("margin.subtitle")}</p>
      {!account && <p className="hint">{t("margin.connectHint")}</p>}

      <div className="card panel">
        <label>{t("margin.poolId")}</label>
        <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
        <label>{t("margin.marginAccountId")}</label>
        <input
          value={marginAccountId}
          onChange={(e) => setMarginAccountId(e.target.value)}
        />
        <label>{t("margin.positionId")}</label>
        <input value={positionId} onChange={(e) => setPositionId(e.target.value)} />
        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending}
            onClick={openAccount}
          >
            {t("margin.openAccount")}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending}
            onClick={register}
          >
            {t("margin.register")}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending}
            onClick={unregister}
          >
            {t("margin.unregister")}
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </div>

      <h2>{t("margin.myAccounts")}</h2>
      {loading && account && <p className="hint">{t("common.loading")}</p>}
      <div className="grid">
        {data?.data?.map((obj) => {
          const raw = parseFields(obj.data?.content);
          const gross = raw?.gross_stake_usdc;
          const slots = raw?.liability_by_slot as Array<string | number> | undefined;
          const linked = raw?.linked_positions as Array<unknown> | undefined;
          let worst = 0n;
          if (slots) {
            for (const s of slots) {
              const v = BigInt(String(s));
              if (v > worst) worst = v;
            }
          }
          return (
            <article key={obj.data?.objectId} className="card">
              <span className="badge">MarginAccount</span>
              <p className="mono">{obj.data?.objectId}</p>
              <p className="hint">
                {t("margin.grossStake")}:{" "}
                {gross != null ? formatUsdcBaseUnits(BigInt(String(gross))) : t("common.dash")} USDC
              </p>
              <p className="hint">
                {t("margin.worstLiability")}: {formatUsdcBaseUnits(worst)} USDC
              </p>
              <p className="hint">
                {t("margin.linkedPositions")}: {linked?.length ?? 0}
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}
