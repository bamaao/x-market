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

import 'package:flutter/widgets.dart';
import 'package:x_market_flutter/l10n/app_localizations.dart';

export 'package:x_market_flutter/l10n/app_localizations.dart';

extension L10nContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}

Locale resolveAppLocale(Locale? locale) {
  const supported = AppLocalizations.supportedLocales;
  if (locale != null) {
    for (final item in supported) {
      if (item.languageCode == locale.languageCode) {
        return item;
      }
    }
  }
  return const Locale('en');
}
