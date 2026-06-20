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

import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "./markets";
import { prepareUsdcPayment } from "./usdc";
import type { CoinsClient } from "./usdc";
import { SUI_CLOCK_ID } from "./trade";

export async function appendDepositLiquidity(
  tx: Transaction,
  client: CoinsClient,
  owner: string,
  poolId: string,
  amountBase: bigint,
) {
  const payment = await prepareUsdcPayment(tx, client, owner, amountBase);
  tx.moveCall({
    target: `${PACKAGE_ID}::pool::deposit_liquidity`,
    arguments: [tx.object(poolId), payment, tx.object(SUI_CLOCK_ID)],
  });
}

export function appendWithdrawLiquidity(
  tx: Transaction,
  poolId: string,
  lpObjectId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::pool::withdraw_liquidity`,
    arguments: [
      tx.object(poolId),
      tx.object(lpObjectId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

const NAV_SCALE = 1_000_000_000n;

function maxLiabilityMtm(liabilityByK: bigint[]): bigint {
  let max = 0n;
  for (const v of liabilityByK) {
    if (v > max) max = v;
  }
  return max;
}

function vaultEquity(vaultUsdc: bigint, liabilityByK: bigint[]): bigint {
  const liab = maxLiabilityMtm(liabilityByK);
  if (vaultUsdc <= liab) return 0n;
  return vaultUsdc - liab;
}

/** Mirrors on-chain `nav::redeem_usdc_amount` for UI preview. */
export function estimateLpRedeemUsdc(
  burnShares: bigint,
  vaultUsdc: bigint,
  liabilityByK: bigint[],
  lpShares: bigint,
): bigint | null {
  if (burnShares === 0n || lpShares === 0n || burnShares > lpShares) return null;
  const equity = vaultEquity(vaultUsdc, liabilityByK);
  if (equity === 0n) return 0n;
  const navPpb = (equity * NAV_SCALE) / lpShares;
  return (burnShares * navPpb) / NAV_SCALE;
}

export function parsePoolNavFields(
  fields: Record<string, unknown> | undefined,
): { vaultUsdc: bigint; liabilityByK: bigint[]; lpShares: bigint } | null {
  if (!fields) return null;
  const liabilityRaw = fields.liability_by_k;
  const liabilityByK = Array.isArray(liabilityRaw)
    ? liabilityRaw.map((v) => BigInt(String(v)))
    : [];
  return {
    vaultUsdc: BigInt(String(fields.collateral_usdc ?? 0)),
    liabilityByK,
    lpShares: BigInt(String(fields.lp_shares ?? 0)),
  };
}
