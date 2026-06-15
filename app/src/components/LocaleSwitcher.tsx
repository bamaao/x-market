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

"use client";

import { useI18n } from "@/i18n/context";
import type { Locale } from "@/i18n/types";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="locale-switcher">
      <span className="sr-only">{t("locale.label")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("locale.label")}
      >
        <option value="en">{t("locale.en")}</option>
        <option value="zh">{t("locale.zh")}</option>
      </select>
    </label>
  );
}
