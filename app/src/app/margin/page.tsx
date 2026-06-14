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

function parseFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

export default function MarginPage() {
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
        onError: (e) => setMsg(`失败: ${e.message}`),
      },
    );
  };

  const openAccount = () => {
    if (!poolId) return setMsg("请先填写 Pool ID");
    const tx = new Transaction();
    appendOpenMarginAccount(tx, poolId);
    runTx(tx, "已创建保证金账户");
  };

  const register = () => {
    if (!marginAccountId || !poolId || !positionId) {
      return setMsg("请填写 MarginAccount / Pool / Position ID");
    }
    const tx = new Transaction();
    appendRegisterPosition(tx, marginAccountId, poolId, positionId);
    runTx(tx, "已登记持仓到保证金账户");
  };

  const unregister = () => {
    if (!marginAccountId || !poolId || !positionId) {
      return setMsg("请填写 MarginAccount / Pool / Position ID");
    }
    const tx = new Transaction();
    appendUnregisterPosition(tx, marginAccountId, poolId, positionId);
    runTx(tx, "已取消登记持仓");
  };

  return (
    <>
      <h1>Cross-Margin</h1>
      <p className="sub">链上保证金账户与持仓责任登记</p>
      {!account && <p className="hint">连接钱包后使用。</p>}

      <div className="card panel">
        <label>Pool ID</label>
        <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
        <label>MarginAccount ID</label>
        <input
          value={marginAccountId}
          onChange={(e) => setMarginAccountId(e.target.value)}
        />
        <label>Position ID</label>
        <input value={positionId} onChange={(e) => setPositionId(e.target.value)} />
        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending}
            onClick={openAccount}
          >
            新建保证金账户
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending}
            onClick={register}
          >
            登记持仓
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending}
            onClick={unregister}
          >
            取消登记
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </div>

      <h2>我的保证金账户</h2>
      {loading && account && <p className="hint">加载中…</p>}
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
                Gross Stake:{" "}
                {gross != null ? formatUsdcBaseUnits(BigInt(String(gross))) : "—"} USDC
              </p>
              <p className="hint">Worst Liability: {formatUsdcBaseUnits(worst)} USDC</p>
              <p className="hint">Linked Positions: {linked?.length ?? 0}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
