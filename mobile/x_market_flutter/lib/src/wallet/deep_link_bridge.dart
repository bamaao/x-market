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
