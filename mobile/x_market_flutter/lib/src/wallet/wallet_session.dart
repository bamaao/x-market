import 'package:flutter/services.dart';

class WalletSession {
  const WalletSession({
    required this.walletId,
    required this.address,
    required this.connectedAtEpochMs,
    this.phantomSessionToken,
    this.phantomWalletPubkeyB58,
    this.phantomDappSecretKeyB58,
    this.phantomDappPublicKeyB58,
  });

  final String walletId;
  final String address;
  final int connectedAtEpochMs;
  final String? phantomSessionToken;
  final String? phantomWalletPubkeyB58;
  final String? phantomDappSecretKeyB58;
  final String? phantomDappPublicKeyB58;

  Map<String, dynamic> toMap() {
    return {
      'walletId': walletId,
      'address': address,
      'connectedAtEpochMs': connectedAtEpochMs,
      if (phantomSessionToken != null)
        'phantomSessionToken': phantomSessionToken,
      if (phantomWalletPubkeyB58 != null)
        'phantomWalletPubkeyB58': phantomWalletPubkeyB58,
      if (phantomDappSecretKeyB58 != null)
        'phantomDappSecretKeyB58': phantomDappSecretKeyB58,
      if (phantomDappPublicKeyB58 != null)
        'phantomDappPublicKeyB58': phantomDappPublicKeyB58,
    };
  }

  static WalletSession? fromMap(Map<dynamic, dynamic>? raw) {
    if (raw == null) {
      return null;
    }
    final walletId = raw['walletId'];
    final address = raw['address'];
    final ts = raw['connectedAtEpochMs'];
    if (walletId is! String || address is! String) {
      return null;
    }
    final connectedAt = ts is int ? ts : int.tryParse('$ts') ?? 0;
    return WalletSession(
      walletId: walletId,
      address: address,
      connectedAtEpochMs: connectedAt,
      phantomSessionToken: raw['phantomSessionToken'] as String?,
      phantomWalletPubkeyB58: raw['phantomWalletPubkeyB58'] as String?,
      phantomDappSecretKeyB58: raw['phantomDappSecretKeyB58'] as String?,
      phantomDappPublicKeyB58: raw['phantomDappPublicKeyB58'] as String?,
    );
  }
}

class WalletSessionStore {
  static const MethodChannel _channel = MethodChannel('x_market/session');

  Future<WalletSession?> load() async {
    try {
      final map = await _channel.invokeMethod<Map<dynamic, dynamic>>(
        'loadSession',
      );
      return WalletSession.fromMap(map);
    } on MissingPluginException {
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> save(WalletSession session) async {
    try {
      await _channel.invokeMethod('saveSession', session.toMap());
    } on MissingPluginException {
      // ignore in tests/unsupported
    }
  }

  Future<void> clear() async {
    try {
      await _channel.invokeMethod('clearSession');
    } on MissingPluginException {
      // ignore in tests/unsupported
    }
  }
}
