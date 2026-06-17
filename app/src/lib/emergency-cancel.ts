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
import { PACKAGE_ID, GLOBAL_CONFIG_ID } from "./markets";
import { SUI_CLOCK_ID } from "./trade";

/** Off-chain reason codes matching on-chain opaque u64 */
export const VOID_REASON = {
  MATCH_CANCELLED: 1,
  MATCH_POSTPONED: 2,
  FORCE_MAJEURE: 3,
  OTHER: 4,
} as const;

export function appendEmergencyVoidMarket(
  tx: Transaction,
  adminCapId: string,
  poolId: string,
  reasonCode: number,
) {
  if (!GLOBAL_CONFIG_ID) {
    throw new Error("NEXT_PUBLIC_GLOBAL_CONFIG is not configured");
  }
  tx.moveCall({
    target: `${PACKAGE_ID}::emergency_cancel::emergency_void_market`,
    arguments: [
      tx.object(GLOBAL_CONFIG_ID),
      tx.object(adminCapId),
      tx.object(poolId),
      tx.pure.u64(reasonCode),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendClaimPositionRefund(
  tx: Transaction,
  poolId: string,
  positionId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::emergency_cancel::claim_position_refund`,
    arguments: [tx.object(poolId), tx.object(positionId)],
  });
}
