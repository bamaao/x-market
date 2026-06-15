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
