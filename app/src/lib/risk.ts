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

/** Mirrors on-chain `lp_guard` / `risk::assert_max_loss_bounded` for buy previews. */

const PPB = 1_000_000_000n;

export function effectiveFeeBps(baseFeeBps: number, feeMultiplierBps: number): number {
  return Math.floor((baseFeeBps * (10_000 + feeMultiplierBps)) / 10_000);
}

export function netStakeAfterFee(stakeRaw: bigint, effectiveFeeBps: number): bigint {
  if (stakeRaw === 0n) return 0n;
  const keep = 10_000n - BigInt(effectiveFeeBps);
  return (stakeRaw * keep) / 10_000n;
}

export function positionPayoutUsdc(stake: bigint, entryProbPpb: bigint): bigint {
  if (entryProbPpb <= 0n) return 0n;
  return (stake * PPB) / entryProbPpb;
}

export function maxLiabilityAfterIntervalBuy(
  liabilityByK: bigint[],
  intervalA: number,
  intervalB: number,
  payout: bigint,
): bigint {
  let maxLiab = 0n;
  for (let k = intervalA; k <= intervalB; k++) {
    const cur = liabilityByK[k] ?? 0n;
    const total = cur + payout;
    if (total > maxLiab) maxLiab = total;
  }
  return maxLiab;
}

export function maxLiabilityAfterDirichletBuy(
  liabilityByK: bigint[],
  outcome: number,
  payout: bigint,
): bigint {
  const cur = liabilityByK[outcome] ?? 0n;
  return cur + payout;
}

export interface MaxLossCheckInput {
  liabilityByK: bigint[];
  stakeRaw: bigint;
  entryProbPpb: bigint;
  vaultUsdc: bigint;
  feeBps: number;
  feeMultiplierBps: number;
  intervalA: number;
  intervalB: number;
  /** Dirichlet single-outcome buys use one bucket only. */
  dirichlet?: boolean;
}

/** Returns true when the buy would abort with `errors::max_loss_exceeded()` (code 7). */
export function buyWouldExceedMaxLoss(input: MaxLossCheckInput): boolean {
  const feeEff = effectiveFeeBps(input.feeBps, input.feeMultiplierBps);
  const stake = netStakeAfterFee(input.stakeRaw, feeEff);
  if (stake === 0n) return true;
  const payout = positionPayoutUsdc(stake, input.entryProbPpb);
  const maxLiab = input.dirichlet
    ? maxLiabilityAfterDirichletBuy(input.liabilityByK, input.intervalA, payout)
    : maxLiabilityAfterIntervalBuy(
        input.liabilityByK,
        input.intervalA,
        input.intervalB,
        payout,
      );
  const vaultAfter = input.vaultUsdc + stake;
  return maxLiab > vaultAfter;
}

const MAX_LOSS_ABORT_RE =
  /abort code:\s*7|max_loss_exceeded|E_MAX_LOSS_EXCEEDED|assert_max_loss_bounded/i;

export function isMaxLossExceededError(message: string): boolean {
  return MAX_LOSS_ABORT_RE.test(message);
}
