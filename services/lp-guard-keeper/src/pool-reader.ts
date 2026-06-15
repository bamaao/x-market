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

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { parsePoolFields } from "./risk-engine.js";
import type { PoolSnapshot } from "./types.js";

export async function fetchPoolSnapshot(
  client: SuiJsonRpcClient,
  poolId: string,
): Promise<PoolSnapshot> {
  const obj = await client.getObject({
    id: poolId,
    options: { showContent: true },
  });
  const content = obj.data?.content;
  if (!content || content.dataType !== "moveObject") {
    throw new Error(`Pool ${poolId} is not a move object`);
  }
  const fields = content.fields as Record<string, unknown>;
  return parsePoolFields(poolId, fields);
}
