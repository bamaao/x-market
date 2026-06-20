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
import {
  SLUG_MAX_LEN,
  fallbackMarketSlug,
  isValidSlug,
  sanitizeSlug,
} from "../../../services/shared/market-slug";

export { SLUG_MAX_LEN, fallbackMarketSlug, isValidSlug, sanitizeSlug };

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
