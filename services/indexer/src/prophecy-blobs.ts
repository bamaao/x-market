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

import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

export const MAX_PROPHET_BLOB_BYTES = 512 * 1024;

export function assertProphecyBlobSize(byteLength: number): void {
  if (byteLength === 0) {
    throw new Error("empty prophecy blob");
  }
  if (byteLength > MAX_PROPHET_BLOB_BYTES) {
    throw new Error("prophecy blob exceeds 512KB limit");
  }
}

export function sanitizePoolRef(poolId: string): string {
  return poolId
    .trim()
    .toLowerCase()
    .replace(/^0x/, "")
    .replace(/[^a-f0-9]+/g, "")
    .slice(0, 16);
}

export function isSafeProphecyBlobFilename(filename: string): boolean {
  return /^[a-f0-9-]+\.bin$/i.test(filename);
}

export function idxBlobId(filename: string): string {
  return `idx:${filename}`;
}

export function parseIdxBlobFilename(blobId: string): string | null {
  if (!blobId.startsWith("idx:")) return null;
  const filename = blobId.slice("idx:".length).trim();
  return isSafeProphecyBlobFilename(filename) ? filename : null;
}

export async function ensureProphecyBlobsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function saveProphecyBlobLocal(
  blobsDir: string,
  poolId: string,
  data: Buffer,
): Promise<{ filename: string; blobId: string }> {
  if (data.length === 0) {
    throw new Error("empty prophecy blob");
  }
  if (data.length > MAX_PROPHET_BLOB_BYTES) {
    throw new Error("prophecy blob exceeds 512KB limit");
  }

  const poolRef = sanitizePoolRef(poolId) || "pool";
  const digest = createHash("sha256").update(data).digest("hex").slice(0, 12);
  const nonce = randomBytes(3).toString("hex");
  const filename = `${poolRef}-${digest}-${nonce}.bin`;
  const filePath = join(blobsDir, filename);

  await ensureProphecyBlobsDir(blobsDir);
  await writeFile(filePath, data);

  return { filename, blobId: idxBlobId(filename) };
}

export async function readProphecyBlobLocal(
  blobsDir: string,
  filename: string,
): Promise<Buffer | null> {
  if (!isSafeProphecyBlobFilename(filename)) return null;
  const filePath = join(blobsDir, filename);
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return null;
  }
  return readFile(filePath);
}
