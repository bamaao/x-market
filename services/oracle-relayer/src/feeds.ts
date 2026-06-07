import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const FEED_OPEN = 0;

function parseFields(content: unknown): Record<string, unknown> | undefined {
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

export async function resolveFeedRegistryId(
  client: SuiJsonRpcClient,
  oracleConfigId: string,
): Promise<string | null> {
  const obj = await client.getObject({
    id: oracleConfigId,
    options: { showContent: true },
  });
  const fields = parseFields(obj.data?.content);
  return parseObjectId(fields?.feed_registry_id) || null;
}

export async function lookupFeedByMarket(
  client: SuiJsonRpcClient,
  packageId: string,
  registryId: string,
  poolId: string,
): Promise<string | null> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::macro_oracle::lookup_feed_entry`,
    arguments: [tx.object(registryId), tx.pure.id(poolId)],
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
  if (!bytes?.length || bytes[0] === 0) return null;
  const idBytes = bytes.slice(1);
  if (idBytes.length !== 32) return null;
  const hex = (idBytes as number[])
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

export interface FeedSnapshot {
  feedId: string;
  poolId: string;
  eventTs: number;
  feedStatus: number;
  hasActiveAssertion: boolean;
  now: number;
}

export async function readFeedSnapshot(
  client: SuiJsonRpcClient,
  feedId: string,
  poolId: string,
): Promise<FeedSnapshot | null> {
  const obj = await client.getObject({
    id: feedId,
    options: { showContent: true },
  });
  const fields = parseFields(obj.data?.content);
  if (!fields) return null;
  const active = fields.active_assertion as
    | { fields?: { vec?: unknown[] } }
    | undefined;
  const hasActive =
    Array.isArray(active?.fields?.vec) && active!.fields!.vec!.length > 0;
  return {
    feedId,
    poolId,
    eventTs: Number(fields.event_ts ?? 0),
    feedStatus: Number(fields.feed_status ?? 0),
    hasActiveAssertion: hasActive,
    now: Math.floor(Date.now() / 1000),
  };
}

export type FeedReminderKind = "propose_ready" | "nullify_soon" | "nullify_overdue";

export function classifyFeed(
  snap: FeedSnapshot,
  nullifyHours: number,
): FeedReminderKind | null {
  if (snap.feedStatus !== FEED_OPEN) return null;
  if (snap.hasActiveAssertion) return null;

  const nullifyDeadline = snap.eventTs + nullifyHours * 3600;
  if (snap.now >= nullifyDeadline) return "nullify_overdue";
  if (snap.now >= nullifyDeadline - 6 * 3600) return "nullify_soon";
  if (snap.now >= snap.eventTs) return "propose_ready";
  return null;
}
