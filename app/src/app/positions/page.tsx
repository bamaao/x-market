"use client";

import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { PACKAGE_ID, SEED_MARKETS } from "@/lib/markets";
import { PositionCard } from "@/components/PositionCard";
import { formatUsdcBaseUnits } from "@/lib/usdc";

function parseFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

const LINEAR_CALL_KIND = 2;
const LINEAR_PUT_KIND = 3;
const STRADDLE_KIND = 4;
const VARIANCE_SWAP_KIND = 5;
const STRUCTURED_NOTE_KIND = 6;
const RANGE_NOTE_KIND = 7;
const BARRIER_NOTE_KIND = 8;
const OUTCOME_SLOTS = 15;

function estimateCrossMargin(
  positions: Array<{
    contract_kind: number;
    interval_a: number;
    interval_b: number;
    stake_usdc: bigint;
    entry_prob_ppb: bigint;
  }>,
): bigint {
  let worst = 0n;
  for (let slot = 0; slot < OUTCOME_SLOTS; slot += 1) {
    let scenario = 0n;
    for (const p of positions) {
      if (p.contract_kind === LINEAR_CALL_KIND) {
        const diff = BigInt(Math.max(slot - p.interval_a, 0));
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === LINEAR_PUT_KIND) {
        const diff = BigInt(Math.max(p.interval_a - slot, 0));
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === STRADDLE_KIND) {
        const diff = BigInt(Math.abs(slot - p.interval_a));
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === VARIANCE_SWAP_KIND) {
        const d = BigInt(Math.abs(slot - p.interval_a));
        scenario += (p.stake_usdc * d * d) / 10n;
      } else if (p.contract_kind === STRUCTURED_NOTE_KIND) {
        const uncapped = BigInt(Math.max(slot - p.interval_a, 0));
        const cap = BigInt(Math.max(p.interval_b - p.interval_a, 0));
        const diff = uncapped > cap ? cap : uncapped;
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === RANGE_NOTE_KIND) {
        if (slot >= p.interval_a && slot <= p.interval_b) {
          scenario += p.stake_usdc;
        }
      } else if (p.contract_kind === BARRIER_NOTE_KIND) {
        if (slot >= p.interval_a) {
          scenario += p.stake_usdc;
        }
      } else if (p.entry_prob_ppb > 0n) {
        // interval / digital legacy products
        const inRange = slot >= p.interval_a && slot <= p.interval_b;
        if (inRange) {
          scenario += (p.stake_usdc * 1_000_000_000n) / p.entry_prob_ppb;
        }
      }
    }
    if (scenario > worst) worst = scenario;
  }
  return worst;
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

  const parsedPositions =
    data?.data
      ?.map((obj) => {
        const raw = parseFields(obj.data?.content);
        if (!raw) return null;
        const stake =
          typeof raw.stake_usdc === "string" || typeof raw.stake_usdc === "number"
            ? BigInt(String(raw.stake_usdc))
            : 0n;
        const entry =
          typeof raw.entry_prob_ppb === "string" ||
          typeof raw.entry_prob_ppb === "number"
            ? BigInt(String(raw.entry_prob_ppb))
            : 0n;
        return {
          contract_kind: Number(raw.contract_kind ?? 0),
          interval_a: Number(raw.interval_a ?? 0),
          interval_b: Number(raw.interval_b ?? 0),
          stake_usdc: stake,
          entry_prob_ppb: entry,
        };
      })
      .filter(Boolean) ?? [];
  const crossMarginVar = estimateCrossMargin(
    parsedPositions as Array<{
      contract_kind: number;
      interval_a: number;
      interval_b: number;
      stake_usdc: bigint;
      entry_prob_ppb: bigint;
    }>,
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
      {account && !isPending && (
        <p className="hint">
          Cross-Margin VaR(估算): {formatUsdcBaseUnits(crossMarginVar)} USDC
        </p>
      )}
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
