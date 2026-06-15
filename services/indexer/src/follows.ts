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

const SUI_ADDRESS_RE = /^0x[a-f0-9]{64}$/;

export function normalizeSuiAddress(addr: string): string {
  const trimmed = addr.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function isValidSuiAddress(addr: string): boolean {
  return SUI_ADDRESS_RE.test(normalizeSuiAddress(addr));
}

export function parseFollowPair(body: Record<string, unknown>): {
  follower: string;
  prophet: string;
} | { error: string } {
  const follower = normalizeSuiAddress(String(body.follower ?? ""));
  const prophet = normalizeSuiAddress(String(body.prophet ?? ""));
  if (!isValidSuiAddress(follower)) return { error: "invalid follower address" };
  if (!isValidSuiAddress(prophet)) return { error: "invalid prophet address" };
  if (follower === prophet) return { error: "cannot follow yourself" };
  return { follower, prophet };
}
