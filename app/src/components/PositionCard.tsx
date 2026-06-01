"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "@/lib/markets";
import { formatUsdcBaseUnits } from "@/lib/usdc";

type PositionFields = {
  market_id?: string;
  contract_kind?: number;
  interval_a?: number;
  interval_b?: number;
  stake_usdc?: string | number;
  entry_prob_ppb?: string | number;
  claimed?: boolean;
};

type Props = {
  objectId: string;
  fields?: PositionFields;
};

export function PositionCard({ objectId, fields }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const stake =
    fields?.stake_usdc != null
      ? formatUsdcBaseUnits(BigInt(String(fields.stake_usdc)))
      : "—";
  const kindLabel =
    fields?.contract_kind === 1
      ? "Digital"
      : fields?.contract_kind === 2
        ? "Linear Call"
        : fields?.contract_kind === 3
          ? "Linear Put"
          : fields?.contract_kind === 4
            ? "Straddle"
            : fields?.contract_kind === 5
              ? "Variance Swap"
              : fields?.contract_kind === 6
                ? "Structured Note"
                : fields?.contract_kind === 7
                  ? "Range Note"
                  : fields?.contract_kind === 8
                    ? "Barrier Note"
            : "Interval";
  const claimed = fields?.claimed === true;

  const claim = () => {
    if (!poolId) {
      setMsg("填写对应 MarketPool ID");
      return;
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::settlement::claim_position`,
      arguments: [tx.object(poolId), tx.object(objectId)],
    });
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => setMsg(`已领取: ${r.digest?.slice(0, 16)}…`),
        onError: (e) => setMsg(e.message),
      },
    );
  };

  return (
    <article className="card">
      <span className="badge">{kindLabel}</span>
      <p className="mono">{objectId.slice(0, 18)}…</p>
      <ul className="pos-meta">
        <li>Stake: {stake} USDC</li>
        <li>
          区间/结果: [{fields?.interval_a ?? "?"}, {fields?.interval_b ?? "?"}]
        </li>
        <li>Market: {(fields?.market_id ?? "").slice(0, 14)}…</li>
        {claimed && <li>已领取</li>}
      </ul>
      {account && !claimed && (
        <>
          <label>Pool ID（结算后领取）</label>
          <input
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            placeholder="0x…"
          />
          <button
            type="button"
            className="secondary"
            disabled={isPending}
            onClick={claim}
          >
            领取赔付
          </button>
        </>
      )}
      {msg && <p className="hint">{msg}</p>}
    </article>
  );
}
