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
