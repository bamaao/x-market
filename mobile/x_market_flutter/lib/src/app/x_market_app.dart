import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/app/app_shell.dart';
import 'package:x_market_flutter/src/l10n/l10n_ext.dart';
import 'package:x_market_flutter/src/theme/app_theme.dart';

class XMarketApp extends StatefulWidget {
  const XMarketApp({super.key, this.controller, this.locale});

  final AppController? controller;
  final Locale? locale;

  @override
  State<XMarketApp> createState() => _XMarketAppState();
}

class _XMarketAppState extends State<XMarketApp> {
  late final AppController _app = widget.controller ??
      AppController(initialLocale: widget.locale);
  late bool _ready;

  @override
  void initState() {
    super.initState();
    _ready = widget.controller != null;
    if (!_ready) {
      _bootstrap();
    }
  }

  Future<void> _bootstrap() async {
    await _app.bootstrap();
    if (mounted) {
      setState(() => _ready = true);
    }
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      _app.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'X-Market',
      theme: AppTheme.light(),
      locale: widget.locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      localeResolutionCallback: (locale, supported) =>
          resolveAppLocale(locale),
      builder: (context, child) {
        _app.setLocale(Localizations.localeOf(context));
        return child ?? const SizedBox.shrink();
      },
      home: _ready
          ? AppShell(app: _app)
          : const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
    );
  }
}
