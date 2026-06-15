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
import { join, extname } from "node:path";

const MAX_COVER_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function sanitizeCoverSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function coverExtension(contentType: string): string | null {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_EXT[normalized] ?? null;
}

export function coverMimeForFilename(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

export function isSafeCoverFilename(filename: string): boolean {
  return /^[a-z0-9-]+\.(png|jpe?g|webp|svg)$/i.test(filename);
}

export async function ensureCoversDir(coversDir: string): Promise<void> {
  await mkdir(coversDir, { recursive: true });
}

export async function saveMarketCover(
  coversDir: string,
  slug: string,
  contentType: string,
  data: Buffer,
): Promise<{ filename: string; imageUrl: string }> {
  if (data.length === 0) {
    throw new Error("empty cover payload");
  }
  if (data.length > MAX_COVER_BYTES) {
    throw new Error("cover exceeds 2MB limit");
  }

  const ext = coverExtension(contentType);
  if (!ext) {
    throw new Error("unsupported cover content type");
  }

  const safeSlug = sanitizeCoverSlug(slug) || "market";
  const digest = createHash("sha256").update(data).digest("hex").slice(0, 10);
  const nonce = randomBytes(3).toString("hex");
  const filename = `${safeSlug}-${digest}-${nonce}${ext}`;
  const filePath = join(coversDir, filename);

  await ensureCoversDir(coversDir);
  await writeFile(filePath, data);

  return {
    filename,
    imageUrl: `/v1/covers/${filename}`,
  };
}

export async function readMarketCover(
  coversDir: string,
  filename: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isSafeCoverFilename(filename)) return null;
  const filePath = join(coversDir, filename);
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return null;
  }
  const data = await readFile(filePath);
  return { data, contentType: coverMimeForFilename(filename) };
}
