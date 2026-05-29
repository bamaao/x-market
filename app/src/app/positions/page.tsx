"use client";

import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { PACKAGE_ID, SEED_MARKETS } from "@/lib/markets";
import { PositionCard } from "@/components/PositionCard";

function parseFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

export default function PositionsPage() {
  const account = useCurrentAccount();
  const { data, isPending, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: {
        StructType: `${PACKAGE_ID}::position::Position`,
      },
      options: { showContent: true, showType: true },
    },
    { enabled: !!account?.address && PACKAGE_ID !== "0x0" },
  );

  return (
    <>
      <h1>持仓</h1>
      <p className="sub">钱包中的 Position 对象（类 NFT）</p>
      <div className="pool-refs">
        {SEED_MARKETS.map((m) => (
          <p key={m.id} className="hint">
            {m.title}:{" "}
            <code>{String(m.params.poolId ?? "").slice(0, 12)}…</code>
          </p>
        ))}
      </div>
      {!account && <p className="hint">连接钱包后查看。</p>}
      {account && (
        <button type="button" className="secondary" onClick={() => refetch()}>
          刷新
        </button>
      )}
      {isPending && account && <p className="hint">加载中…</p>}
      <div className="grid">
        {data?.data?.map((obj) => {
          const raw = parseFields(obj.data?.content);
          const fields = raw
            ? {
                market_id: String(raw.market_id ?? ""),
                contract_kind: Number(raw.contract_kind ?? 0),
                interval_a: Number(raw.interval_a ?? 0),
                interval_b: Number(raw.interval_b ?? 0),
                stake_usdc:
                  typeof raw.stake_usdc === "string" ||
                  typeof raw.stake_usdc === "number"
                    ? raw.stake_usdc
                    : undefined,
                entry_prob_ppb:
                  typeof raw.entry_prob_ppb === "string" ||
                  typeof raw.entry_prob_ppb === "number"
                    ? raw.entry_prob_ppb
                    : undefined,
                claimed: Boolean(raw.claimed),
              }
            : undefined;
          return (
            <PositionCard
              key={obj.data?.objectId}
              objectId={obj.data?.objectId ?? ""}
              fields={fields}
            />
          );
        })}
      </div>
      {account && data?.data?.length === 0 && !isPending && (
        <p className="hint">暂无 Position，去市场页用 USDC 买入。</p>
      )}
    </>
  );
}
