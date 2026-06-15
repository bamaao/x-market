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

/**
 * IPFS gateway for resolving market cover CIDs (ipfs://…).
 * Set NEXT_PUBLIC_IPFS_GATEWAY_URL (default: https://w3s.link).
 */

export const IPFS_GATEWAY_URL =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL?.replace(/\/$/, "") ??
  "https://w3s.link";

/** Parse ipfs://CID or ipfs:CID → raw CID string. */
export function parseIpfsCid(ref: string): string | null {
  const trimmed = ref.trim();
  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice("ipfs://".length).split("/")[0]?.trim();
    return cid || null;
  }
  if (trimmed.startsWith("ipfs:")) {
    const cid = trimmed.slice("ipfs:".length).split("/")[0]?.trim();
    return cid || null;
  }
  return null;
}

export function ipfsCidToGatewayUrl(cid: string): string {
  const clean = cid.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${IPFS_GATEWAY_URL}/ipfs/${encodeURIComponent(clean)}`;
}

export function resolveIpfsRef(ref: string): string | undefined {
  const cid = parseIpfsCid(ref);
  if (!cid) return undefined;
  return ipfsCidToGatewayUrl(cid);
}
