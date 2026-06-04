import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/app/app_shell.dart';
import 'package:x_market_flutter/src/theme/app_theme.dart';

class XMarketApp extends StatefulWidget {
  const XMarketApp({super.key, this.controller});

  final AppController? controller;

  @override
  State<XMarketApp> createState() => _XMarketAppState();
}

class _XMarketAppState extends State<XMarketApp> {
  late final AppController _app = widget.controller ?? AppController();
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
      home: _ready
          ? AppShell(app: _app)
          : const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
    );
  }
}
