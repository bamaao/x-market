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

import { pinyin } from "pinyin-pro";

// Keep in sync with services/shared/market-slug.ts (indexer cover paths use the same rules).
export const SLUG_MAX_LEN = 48;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Strip to URL-safe slug (lowercase a-z, digits, hyphens). */
export function sanitizeSlug(input: string, maxLen = SLUG_MAX_LEN): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function fallbackMarketSlug(): string {
  return `market-${Date.now().toString(36)}`;
}

/** Convert CJK to hyphenated pinyin; keep Latin/digits, drop other symbols. */
function transliterateTitle(title: string): string {
  return pinyin(title.trim(), {
    toneType: "none",
    type: "string",
    separator: "-",
    nonZh: "consecutive",
  });
}

/** Derive a market slug from a human title (pinyin for Chinese, then sanitize). */
export function slugifyTitle(title: string): string {
  const candidate = sanitizeSlug(transliterateTitle(title));
  return candidate || fallbackMarketSlug();
}
