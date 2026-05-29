import type { Transaction } from "@mysten/sui/transactions";
import type { MarketKind } from "./markets";
import { PACKAGE_ID } from "./markets";

export type ContractMode =
  | "interval"
  | "digital"
  | "linear_call"
  | "linear_put"
  | "straddle";
export const SUI_CLOCK_ID = process.env.NEXT_PUBLIC_SUI_CLOCK ?? "0x6";

export interface TradeParams {
  poolId: string;
  mode: ContractMode;
  /** Poisson interval [a,b] or digital k */
  poissonA?: number;
  poissonB?: number;
  poissonK?: number;
  /** Dirichlet outcome 0|1|2 */
  dirichletOutcome?: number;
  /** Normal interval / digital threshold (tenths units on CPI pool) */
  normalA?: number;
  normalB?: number;
  normalThreshold?: number;
  normalStrike?: number;
}

export function appendBuyMoveCall(
  tx: Transaction,
  kind: MarketKind,
  payment: ReturnType<Transaction["splitCoins"]>,
  poolId: string,
  params: TradeParams,
) {
  const pkg = PACKAGE_ID;
  const pool = tx.object(poolId);

  if (kind === "poisson") {
    if (params.mode === "digital") {
      const k = params.poissonK ?? 2;
      tx.moveCall({
        target: `${pkg}::pool::buy_poisson_digital`,
        arguments: [pool, payment, tx.pure.u8(k), tx.object(SUI_CLOCK_ID)],
      });
    } else {
      const a = params.poissonA ?? 2;
      const b = params.poissonB ?? 3;
      tx.moveCall({
        target: `${pkg}::pool::buy_poisson_interval`,
        arguments: [
          pool,
          payment,
          tx.pure.u8(a),
          tx.pure.u8(b),
          tx.object(SUI_CLOCK_ID),
        ],
      });
    }
    return;
  }

  if (kind === "dirichlet") {
    const outcome = params.dirichletOutcome ?? 0;
    tx.moveCall({
      target: `${pkg}::pool::buy_dirichlet_outcome`,
      arguments: [pool, payment, tx.pure.u8(outcome), tx.object(SUI_CLOCK_ID)],
    });
    return;
  }

  if (params.mode === "digital") {
    const t = params.normalThreshold ?? 30;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_digital`,
      arguments: [pool, payment, tx.pure.u64(t), tx.object(SUI_CLOCK_ID)],
    });
  } else if (params.mode === "linear_call") {
    const strike = params.normalStrike ?? 25;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_linear_call`,
      arguments: [pool, payment, tx.pure.u64(strike), tx.object(SUI_CLOCK_ID)],
    });
  } else if (params.mode === "linear_put") {
    const strike = params.normalStrike ?? 25;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_linear_put`,
      arguments: [pool, payment, tx.pure.u64(strike), tx.object(SUI_CLOCK_ID)],
    });
  } else if (params.mode === "straddle") {
    const strike = params.normalStrike ?? 25;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_straddle`,
      arguments: [pool, payment, tx.pure.u64(strike), tx.object(SUI_CLOCK_ID)],
    });
  } else {
    const a = params.normalA ?? 25;
    const b = params.normalB ?? 27;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_interval`,
      arguments: [
        pool,
        payment,
        tx.pure.u64(a),
        tx.pure.u64(b),
        tx.object(SUI_CLOCK_ID),
      ],
    });
  }
}

export function defaultTradeParams(
  kind: MarketKind,
  mode: ContractMode,
): Omit<TradeParams, "poolId" | "mode"> {
  if (kind === "poisson") {
    return mode === "digital"
      ? { poissonK: 2 }
      : { poissonA: 2, poissonB: 3 };
  }
  if (kind === "dirichlet") {
    return { dirichletOutcome: 0 };
  }
  if (mode === "digital") return { normalThreshold: 30 };
  if (mode === "linear_call" || mode === "linear_put" || mode === "straddle") {
    return { normalStrike: 25 };
  }
  return { normalA: 25, normalB: 27 };
}
