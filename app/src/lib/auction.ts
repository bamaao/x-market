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
import type { MarketKind } from "./markets";
import { PACKAGE_ID } from "./markets";
import { prepareUsdcPayment } from "./usdc";
import type { CoinsClient } from "./usdc";

export function appendAuctionBid(
  tx: Transaction,
  poolId: string,
  payment: ReturnType<Transaction["splitCoins"]>,
  bucketIndex: number,
  clockId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::pool::auction_bid`,
    arguments: [
      tx.object(poolId),
      payment,
      tx.pure.u8(bucketIndex),
      tx.object(clockId),
    ],
  });
}

export function appendFinalizeAuction(
  tx: Transaction,
  kind: MarketKind,
  poolId: string,
  clockId: string,
) {
  const target =
    kind === "dirichlet"
      ? `${PACKAGE_ID}::pool::finalize_dirichlet_auction`
      : kind === "normal"
        ? `${PACKAGE_ID}::pool::finalize_normal_auction`
        : `${PACKAGE_ID}::pool::finalize_poisson_auction`;
  tx.moveCall({
    target,
    arguments: [tx.object(poolId), tx.object(clockId)],
  });
}

export async function buildAuctionBidTx(
  client: CoinsClient,
  owner: string,
  poolId: string,
  amountBase: bigint,
  bucketIndex: number,
  clockId: string,
): Promise<Transaction> {
  const tx = new Transaction();
  const payment = await prepareUsdcPayment(tx, client, owner, amountBase);
  appendAuctionBid(tx, poolId, payment, bucketIndex, clockId);
  return tx;
}
