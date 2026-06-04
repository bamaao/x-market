import 'package:flutter/services.dart';

class DeepLinkBridge {
  DeepLinkBridge._();

  static final DeepLinkBridge instance = DeepLinkBridge._();
  static const MethodChannel _channel = MethodChannel('x_market/deeplink');

  Future<void> initialize({
    required Future<void> Function(String rawUri) onDeepLink,
  }) async {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onDeepLink' && call.arguments is String) {
        await onDeepLink(call.arguments as String);
      }
    });

    try {
      final initial = await _channel.invokeMethod<String>('getInitialLink');
      if (initial != null && initial.isNotEmpty) {
        await onDeepLink(initial);
      }
    } on MissingPluginException {
      // Widget tests / unsupported platforms.
    } catch (_) {
      // Keep app usable even if bridge is unavailable.
    }
  }
}
