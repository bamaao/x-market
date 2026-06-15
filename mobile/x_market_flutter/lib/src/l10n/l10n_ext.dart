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
