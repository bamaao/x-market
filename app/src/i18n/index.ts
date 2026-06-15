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

export { I18nProvider, useI18n, useT } from "./context";
export { createTranslator, detectBrowserLocale, resolveLocale } from "./core";
export { localizeSeedMarket, useLocalizedSeedMarket, useLocalizedTagLabel } from "./markets";
export type { Locale } from "./types";
export type { Translator } from "./core";
