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
import { PACKAGE_ID, SEED_MARKETS } from "@/lib/markets";
import { formatUsdcBaseUnits } from "@/lib/usdc";
import { appendWithdrawLiquidity } from "@/lib/lp";
import { useT } from "@/i18n/context";

export default function LpPage() {
  const t = useT();
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending: withdrawing } =
    useSignAndExecuteTransaction();
  const [poolIds, setPoolIds] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const { data, isPending, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: {
        StructType: `${PACKAGE_ID}::lp_token::LpShare`,
      },
      options: { showContent: true },
    },
    { enabled: !!account?.address && PACKAGE_ID !== "0x0" },
  );

  const withdraw = (lpObjectId: string) => {
    const poolId = poolIds[lpObjectId]?.trim();
    if (!poolId) {
      setStatus(t("lp.fillPoolId"));
      return;
    }
    const tx = new Transaction();
    appendWithdrawLiquidity(tx, poolId, lpObjectId);
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setStatus(t("common.txSuccess", { digest: r.digest?.slice(0, 18) ?? "" }));
          void refetch();
        },
        onError: (e) => setStatus(t("trade.failed", { message: e.message })),
      },
    );
  };

  return (
    <>
      <h1>{t("lp.title")}</h1>
      <p className="sub">{t("lp.subtitle")}</p>
      {!account && <p className="hint">{t("lp.connectHint")}</p>}
      {account && (
        <button type="button" className="secondary" onClick={() => refetch()}>
          {t("common.refresh")}
        </button>
      )}
      <div className="grid">
        {data?.data?.map((obj) => {
          const content = obj.data?.content as
            | { dataType?: string; fields?: Record<string, unknown> }
            | undefined;
          const fields =
            content?.dataType === "moveObject" ? content.fields : undefined;
          const shares = fields?.shares;
          const marketId = String(fields?.market_id ?? "");
          const marketTitle =
            SEED_MARKETS.find((m) => String(m.params.poolId ?? "") === marketId)
              ?.title ?? t("nav.markets");
          const lpObjectId = obj.data?.objectId ?? "";
          return (
            <article key={lpObjectId} className="card">
              <span className="badge">LpShare</span>
              <p>{marketTitle}</p>
              <p className="hint">
                {t("lp.shares", {
                  amount:
                    shares != null
                      ? formatUsdcBaseUnits(BigInt(String(shares)))
                      : t("common.dash"),
                })}
              </p>
              <label>{t("lp.poolIdLabel")}</label>
              <input
                value={poolIds[lpObjectId] ?? ""}
                onChange={(e) =>
                  setPoolIds((prev) => ({ ...prev, [lpObjectId]: e.target.value }))
                }
                placeholder="0x..."
              />
              <button
                type="button"
                className="secondary"
                disabled={!account || withdrawing}
                onClick={() => withdraw(lpObjectId)}
              >
                {withdrawing ? t("common.processing") : t("lp.redeem")}
              </button>
              <p className="mono">{lpObjectId}</p>
            </article>
          );
        })}
      </div>
      {status && <p className="hint">{status}</p>}
      {account && data?.data?.length === 0 && !isPending && (
        <p className="hint">{t("lp.empty")}</p>
      )}
    </>
  );
}
