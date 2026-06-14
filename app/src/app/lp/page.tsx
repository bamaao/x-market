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

export default function LpPage() {
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
      setStatus("请填写该 LpShare 对应的 Pool ID");
      return;
    }
    const tx = new Transaction();
    appendWithdrawLiquidity(tx, poolId, lpObjectId);
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setStatus(`赎回成功: ${r.digest?.slice(0, 18)}…`);
          void refetch();
        },
        onError: (e) => setStatus(`赎回失败: ${e.message}`),
      },
    );
  };

  return (
    <>
      <h1>LP 份额</h1>
      <p className="sub">LpShare 对象（NAV 申购与赎回）</p>
      {!account && <p className="hint">连接钱包后查看。</p>}
      {account && (
        <button type="button" className="secondary" onClick={() => refetch()}>
          刷新
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
              ?.title ?? "市场";
          const lpObjectId = obj.data?.objectId ?? "";
          return (
            <article key={lpObjectId} className="card">
              <span className="badge">LpShare</span>
              <p>{marketTitle}</p>
              <p className="hint">
                份额:{" "}
                {shares != null
                  ? formatUsdcBaseUnits(BigInt(String(shares)))
                  : "—"}
              </p>
              <label>Pool ID（用于 withdraw_liquidity）</label>
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
                {withdrawing ? "处理中…" : "赎回 LP"}
              </button>
              <p className="mono">{lpObjectId}</p>
            </article>
          );
        })}
      </div>
      {status && <p className="hint">{status}</p>}
      {account && data?.data?.length === 0 && !isPending && (
        <p className="hint">暂无 LP，可在市场页 deposit_liquidity 申购。</p>
      )}
    </>
  );
}
