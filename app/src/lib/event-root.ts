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
import type { XMarketRpc } from "./rpc";
import { PACKAGE_ID } from "./markets";

export interface EventRootView {
  id: string;
  eventId: string;
  lockTime: number;
  oracleFeedId: string;
  status: number;
  poolId: string | null;
  prophetRegistryId: string | null;
}

const EVENT_ROOT_POISSON = process.env.NEXT_PUBLIC_EVENT_ROOT_POISSON ?? "";
const EVENT_ROOT_DIRICHLET = process.env.NEXT_PUBLIC_EVENT_ROOT_DIRICHLET ?? "";
const EVENT_ROOT_NORMAL = process.env.NEXT_PUBLIC_EVENT_ROOT_NORMAL ?? "";

export const EVENT_ROOT_BY_POOL: Record<string, string> = {};
if (process.env.NEXT_PUBLIC_POOL_POISSON && EVENT_ROOT_POISSON) {
  EVENT_ROOT_BY_POOL[process.env.NEXT_PUBLIC_POOL_POISSON] = EVENT_ROOT_POISSON;
}
if (process.env.NEXT_PUBLIC_POOL_DIRICHLET && EVENT_ROOT_DIRICHLET) {
  EVENT_ROOT_BY_POOL[process.env.NEXT_PUBLIC_POOL_DIRICHLET] = EVENT_ROOT_DIRICHLET;
}
if (process.env.NEXT_PUBLIC_POOL_NORMAL && EVENT_ROOT_NORMAL) {
  EVENT_ROOT_BY_POOL[process.env.NEXT_PUBLIC_POOL_NORMAL] = EVENT_ROOT_NORMAL;
}

function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

function parseObjectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: string }).id);
  }
  return "";
}

function decodeBytes(value: unknown): string {
  if (typeof value === "string") {
    try {
      return new TextDecoder().decode(
        Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
      );
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return new TextDecoder().decode(Uint8Array.from(value as number[]));
  }
  return "";
}

export async function fetchEventRoot(
  client: XMarketRpc,
  rootId: string,
): Promise<EventRootView | null> {
  const obj = await client.getObject({
    id: rootId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  if (!fields) return null;

  let poolId: string | null = null;
  let prophetRegistryId: string | null = null;
  if (client.getDynamicFieldObject) {
    try {
      const amm = await client.getDynamicFieldObject({
        parentId: rootId,
        name: { type: "vector<u8>", value: "amm" },
      });
      const ammFields = parseMoveFields(amm.data?.content);
      if (ammFields) poolId = parseObjectId(ammFields.pool_id);
    } catch {
      /* optional */
    }
    try {
      const pr = await client.getDynamicFieldObject({
        parentId: rootId,
        name: { type: "vector<u8>", value: "prophet_registry" },
      });
      const prFields = parseMoveFields(pr.data?.content);
      if (prFields) prophetRegistryId = parseObjectId(prFields.registry_id);
    } catch {
      /* optional */
    }
  }

  return {
    id: rootId,
    eventId: decodeBytes(fields.event_id),
    lockTime: Number(fields.lock_time ?? 0),
    oracleFeedId: parseObjectId(fields.oracle_feed_id),
    status: Number(fields.status ?? 0),
    poolId,
    prophetRegistryId,
  };
}

export async function lookupPoolFromEventRoot(
  client: XMarketRpc,
  rootId: string,
): Promise<string | null> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::event_root::amm_pool_id`,
    arguments: [tx.object(rootId)],
  });
  const inspect = await client.devInspectTransactionBlock({
    sender:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    transactionBlock: tx,
  });
  if (inspect.error) return null;
  const raw = inspect.results?.[0]?.returnValues?.[0];
  if (!raw) return null;
  const [bytes] = raw;
  if (!bytes?.length || bytes[0] !== 1) return null;
  const hex = (bytes as number[])
    .slice(1, 33)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

export function eventRootStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return "Open";
    case 1:
      return "Trading";
    case 2:
      return "Locked";
    case 3:
      return "Settled";
    case 4:
      return "Nullified";
    default:
      return `Unknown(${status})`;
  }
}
