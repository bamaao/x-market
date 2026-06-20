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

import type { Transaction } from "@mysten/sui/transactions";
import type { MarketKind } from "./markets";
import { PACKAGE_ID } from "./markets";
import type { UsdcPaymentArg } from "./usdc";

export type ContractMode =
  | "interval"
  | "digital"
  | "linear_call"
  | "linear_put"
  | "straddle"
  | "variance_swap"
  | "structured_note"
  | "range_note"
  | "barrier_note";
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
  normalCap?: number;
  normalLower?: number;
  normalUpper?: number;
  normalBarrier?: number;
  /** Beta interval bounds in permille (350 = 35.0%) */
  betaA?: number;
  betaB?: number;
}

export function appendBuyMoveCall(
  tx: Transaction,
  kind: MarketKind,
  payment: UsdcPaymentArg,
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

  if (kind === "beta") {
    const a = params.betaA ?? 350;
    const b = params.betaB ?? 400;
    tx.moveCall({
      target: `${pkg}::pool::buy_beta_interval`,
      arguments: [
        pool,
        payment,
        tx.pure.u64(a),
        tx.pure.u64(b),
        tx.object(SUI_CLOCK_ID),
      ],
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
  } else if (params.mode === "variance_swap") {
    const strike = params.normalStrike ?? 25;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_variance_swap`,
      arguments: [pool, payment, tx.pure.u64(strike), tx.object(SUI_CLOCK_ID)],
    });
  } else if (params.mode === "structured_note") {
    const strike = params.normalStrike ?? 25;
    const cap = params.normalCap ?? 30;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_structured_note`,
      arguments: [
        pool,
        payment,
        tx.pure.u64(strike),
        tx.pure.u64(cap),
        tx.object(SUI_CLOCK_ID),
      ],
    });
  } else if (params.mode === "range_note") {
    const lower = params.normalLower ?? 24;
    const upper = params.normalUpper ?? 28;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_range_note`,
      arguments: [
        pool,
        payment,
        tx.pure.u64(lower),
        tx.pure.u64(upper),
        tx.object(SUI_CLOCK_ID),
      ],
    });
  } else if (params.mode === "barrier_note") {
    const barrier = params.normalBarrier ?? 26;
    tx.moveCall({
      target: `${pkg}::pool::buy_normal_barrier_note`,
      arguments: [pool, payment, tx.pure.u64(barrier), tx.object(SUI_CLOCK_ID)],
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
  if (kind === "beta") {
    return { betaA: 350, betaB: 400 };
  }
  if (mode === "digital") return { normalThreshold: 30 };
  if (
    mode === "linear_call" ||
    mode === "linear_put" ||
    mode === "straddle" ||
    mode === "variance_swap"
  ) {
    return { normalStrike: 25 };
  }
  if (mode === "structured_note") return { normalStrike: 25, normalCap: 30 };
  if (mode === "range_note") return { normalLower: 24, normalUpper: 28 };
  if (mode === "barrier_note") return { normalBarrier: 26 };
  return { normalA: 25, normalB: 27 };
}
