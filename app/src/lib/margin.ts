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

export function appendOpenMarginAccount(tx: Transaction, poolId: string) {
  tx.moveCall({
    target: `${PACKAGE_ID}::cross_margin::open_account`,
    arguments: [tx.object(poolId)],
  });
}

export function appendRegisterPosition(
  tx: Transaction,
  marginAccountId: string,
  poolId: string,
  positionId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::cross_margin::register_position`,
    arguments: [tx.object(marginAccountId), tx.object(poolId), tx.object(positionId)],
  });
}

export function appendUnregisterPosition(
  tx: Transaction,
  marginAccountId: string,
  poolId: string,
  positionId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::cross_margin::unregister_position`,
    arguments: [tx.object(marginAccountId), tx.object(poolId), tx.object(positionId)],
  });
}
