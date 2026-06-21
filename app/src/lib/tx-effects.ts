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

import type { XMarketRpc } from "./rpc";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const nested = err as { message?: unknown; error?: unknown };
    if (typeof nested.message === "string") return nested.message;
    if (typeof nested.error === "string") return nested.error;
  }
  return String(err);
}

function isTxNotFoundError(err: unknown): boolean {
  const msg = errorMessage(err);
  return /could not find|not found|transaction not found|referenced transaction/i.test(
    msg,
  );
}

export function parseCreatedObjectIdFromChanges(
  objectChanges: readonly unknown[] | undefined,
  objectType: string,
): string | null {
  for (const change of objectChanges ?? []) {
    if (
      change &&
      typeof change === "object" &&
      "type" in change &&
      change.type === "created" &&
      "objectType" in change &&
      change.objectType === objectType &&
      "objectId" in change &&
      typeof change.objectId === "string"
    ) {
      return change.objectId;
    }
  }
  return null;
}

export function parseCreatedObjectIdByTypeSuffix(
  objectChanges: readonly unknown[] | undefined,
  typeSuffix: string,
): string | null {
  for (const change of objectChanges ?? []) {
    if (
      change &&
      typeof change === "object" &&
      "type" in change &&
      change.type === "created" &&
      "objectType" in change &&
      String(change.objectType).includes(typeSuffix) &&
      "objectId" in change &&
      typeof change.objectId === "string"
    ) {
      return change.objectId;
    }
  }
  return null;
}

/** Poll until a digest is queryable; never throws (RPC indexing lag safe). */
export async function fetchTransactionObjectChanges(
  client: XMarketRpc,
  digest: string,
): Promise<readonly unknown[] | undefined> {
  if (!client.getTransactionBlock) return undefined;

  try {
    await sleep(400);
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const tx = await client.getTransactionBlock({
          digest,
          options: { showObjectChanges: true },
        });
        if (tx.objectChanges?.length) return tx.objectChanges;
      } catch (e) {
        if (!isTxNotFoundError(e)) {
          console.warn("fetchTransactionObjectChanges:", errorMessage(e));
          return undefined;
        }
      }
      await sleep(Math.min(600 * (attempt + 1), 5000));
    }
  } catch (e) {
    console.warn("fetchTransactionObjectChanges failed:", errorMessage(e));
  }
  return undefined;
}
