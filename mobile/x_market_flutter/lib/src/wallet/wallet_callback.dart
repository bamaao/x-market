class WalletCallbackResult {
  const WalletCallbackResult({
    required this.walletId,
    required this.success,
    required this.message,
    this.address,
    this.raw,
    this.queryParameters = const {},
  });

  final String walletId;
  final bool success;
  final String message;
  final String? address;
  final String? raw;
  final Map<String, String> queryParameters;
}

class WalletCallbackService {
  static const String callbackScheme = 'xmarket';
  static const String callbackHost = 'wallet-callback';

  String buildCallbackUri({required String walletId}) {
    return '$callbackScheme://$callbackHost?wallet=$walletId';
  }

  WalletCallbackResult parse(String rawUri) {
    final uri = Uri.tryParse(rawUri.trim());
    if (uri == null) {
      return const WalletCallbackResult(
        walletId: 'unknown',
        success: false,
        message: '回调 URL 解析失败',
        raw: null,
      );
    }

    if (uri.scheme != callbackScheme || uri.host != callbackHost) {
      return WalletCallbackResult(
        walletId: uri.queryParameters['wallet'] ?? 'unknown',
        success: false,
        message: '回调协议不匹配（期望 xmarket://wallet-callback）',
        raw: null,
        queryParameters: const {},
      );
    }

    final walletId = uri.queryParameters['wallet'] ?? 'unknown';
    final status = uri.queryParameters['status'] ?? 'ok';
    final error = uri.queryParameters['error'];
    final phantomErrorCode = uri.queryParameters['errorCode'];
    final phantomNonce = uri.queryParameters['nonce'];
    final phantomData = uri.queryParameters['data'];
    final address = _normalizeAddress(
      uri.queryParameters['address'] ?? uri.queryParameters['public_key'],
    );

    if ((error != null && error.isNotEmpty) ||
        (phantomErrorCode != null && phantomErrorCode.isNotEmpty)) {
      final composedError = [
        if (error != null && error.isNotEmpty) error,
        if (phantomErrorCode != null && phantomErrorCode.isNotEmpty)
          'errorCode=$phantomErrorCode',
      ].join(', ');
      return WalletCallbackResult(
        walletId: walletId,
        success: false,
        message: '钱包返回错误: $composedError',
        address: address,
        raw: rawUri,
        queryParameters: uri.queryParameters,
      );
    }

    if (status != 'ok' && status != 'success') {
      return WalletCallbackResult(
        walletId: walletId,
        success: false,
        message: '钱包返回状态: $status',
        address: address,
        raw: rawUri,
        queryParameters: uri.queryParameters,
      );
    }

    final extra = [
      if (phantomNonce != null && phantomNonce.isNotEmpty) 'nonce=ok',
      if (phantomData != null && phantomData.isNotEmpty) 'data=ok',
    ].join(', ');
    return WalletCallbackResult(
      walletId: walletId,
      success: true,
      message: extra.isEmpty ? '钱包回调成功' : '钱包回调成功 ($extra)',
      address: address,
      raw: rawUri,
      queryParameters: uri.queryParameters,
    );
  }

  String buildMockSuccessUri({
    required String walletId,
    required String address,
  }) {
    return '$callbackScheme://$callbackHost?wallet=$walletId&status=ok&address=$address';
  }

  String? _normalizeAddress(String? input) {
    if (input == null || input.isEmpty) {
      return null;
    }
    final value = input.toLowerCase();
    final candidate = value.startsWith('0x') ? value : '0x$value';
    final hex = candidate.substring(2);
    final hexRegex = RegExp(r'^[0-9a-f]+$');
    if (hex.isEmpty || hex.length > 64 || !hexRegex.hasMatch(hex)) {
      return null;
    }
    return '0x${hex.padLeft(64, '0')}';
  }
}
