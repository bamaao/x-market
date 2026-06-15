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
