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

function isTxNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /could not find|not found|transaction not found/i.test(msg);
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

/** Wait for a digest to be queryable and return object changes (RPC indexing lag safe). */
export async function fetchTransactionObjectChanges(
  client: XMarketRpc,
  digest: string,
): Promise<readonly unknown[] | undefined> {
  const clientEx = client as XMarketRpc & {
    waitForTransaction?: (input: {
      digest: string;
      options?: { showObjectChanges?: boolean };
      timeout?: number;
    }) => Promise<{ objectChanges?: unknown[] }>;
    waitForTransactionBlock?: (input: {
      digest: string;
      options?: { showObjectChanges?: boolean };
      timeout?: number;
    }) => Promise<{ objectChanges?: unknown[] }>;
  };

  const waitFn = clientEx.waitForTransactionBlock ?? clientEx.waitForTransaction;
  if (waitFn) {
    try {
      const waited = await waitFn({
        digest,
        options: { showObjectChanges: true },
        timeout: 60_000,
      });
      if (waited.objectChanges?.length) return waited.objectChanges;
    } catch (e) {
      if (!isTxNotFoundError(e)) throw e;
    }
  }

  if (!client.getTransactionBlock) return undefined;

  await sleep(300);
  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const tx = await client.getTransactionBlock({
        digest,
        options: { showObjectChanges: true },
      });
      if (tx.objectChanges?.length) return tx.objectChanges;
    } catch (e) {
      if (!isTxNotFoundError(e)) throw e;
    }
    await sleep(Math.min(500 * (attempt + 1), 4000));
  }
  return undefined;
}
