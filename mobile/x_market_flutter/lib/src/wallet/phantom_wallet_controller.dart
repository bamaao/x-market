import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:x_market_flutter/src/rust/api/phantom.dart';
import 'package:x_market_flutter/src/sui_config.dart';
import 'package:x_market_flutter/src/trade/buy_transaction_service.dart';
import 'package:x_market_flutter/src/wallet/deep_link_bridge.dart';
import 'package:x_market_flutter/src/wallet/wallet_callback.dart';
import 'package:x_market_flutter/src/wallet/wallet_deeplink.dart';
import 'package:x_market_flutter/src/wallet/wallet_session.dart';

enum PhantomSubmitMode { signOnly, signAndSend }

class PhantomWalletController extends ChangeNotifier {
  PhantomWalletController({
    WalletSessionStore? sessionStore,
    WalletDeepLinkService? deepLinkService,
    WalletCallbackService? callbackService,
  }) : _sessionStore = sessionStore ?? WalletSessionStore(),
       _deepLinkService = deepLinkService ?? WalletDeepLinkService(),
       _callbackService = callbackService ?? WalletCallbackService();

  final WalletSessionStore _sessionStore;
  final WalletDeepLinkService _deepLinkService;
  final WalletCallbackService _callbackService;
  final ChainTransactionService _tx = ChainTransactionService();

  WalletSession? session;
  String? phantomDappSecretKeyB58;
  String? phantomDappPublicKeyB58;
  String? statusMessage;
  String? errorMessage;
  bool busy = false;

  String? _pendingTxBytesBase64;
  String? _pendingDescription;
  String? _pendingSender;
  String? _pendingSponsorSignature;
  String? _pendingGasOwner;
  bool _expectingBuySign = false;
  bool _expectingSignAndSend = false;
  Future<void> Function(String digest)? _onSuccess;

  bool get isConnected =>
      session != null && session!.walletId == 'phantom' && session!.address.isNotEmpty;

  String? get address => session?.address;

  Future<void> initialize() async {
    await DeepLinkBridge.instance.initialize(
      onDeepLink: (uri) => handleCallbackUri(uri),
    );
    await restoreSession();
  }

  Future<void> restoreSession() async {
    final saved = await _sessionStore.load();
    if (saved == null) {
      return;
    }
    session = saved;
    phantomDappSecretKeyB58 = saved.phantomDappSecretKeyB58;
    phantomDappPublicKeyB58 = saved.phantomDappPublicKeyB58;
    statusMessage = '已恢复 Phantom 会话';
    notifyListeners();
  }

  Future<void> connectPhantom({String dappUrl = 'https://x-market-sui.vercel.app'}) async {
    busy = true;
    errorMessage = null;
    notifyListeners();
    try {
      var pubkey = phantomDappPublicKeyB58 ?? '';
      if (pubkey.isEmpty) {
        final keypairJson = phantomGenerateDappEncryptionKeypair();
        final keypair = jsonDecode(keypairJson) as Map<String, dynamic>;
        pubkey = keypair['public_key_b58'] as String? ?? '';
        phantomDappSecretKeyB58 = keypair['secret_key_b58'] as String?;
        phantomDappPublicKeyB58 = pubkey;
      }
      final deeplink = _deepLinkService.buildLaunchUri(
        app: WalletDeepLinkService.apps.first,
        dappUrl: dappUrl,
        redirectUri: _callbackService.buildCallbackUri(walletId: 'phantom'),
        network: SuiConfig.network,
        extras: {'phantom_key': pubkey},
      );
      statusMessage = '正在打开 Phantom…';
      notifyListeners();
      await _openExternal(deeplink);
    } catch (e) {
      errorMessage = '连接 Phantom 失败: $e';
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> submitTransaction(
    PendingBuyTransaction pending, {
    required String sender,
    PhantomSubmitMode mode = PhantomSubmitMode.signAndSend,
    Future<void> Function(String digest)? onSuccess,
  }) async {
    final s = session;
    if (s == null ||
        s.phantomSessionToken == null ||
        s.phantomWalletPubkeyB58 == null ||
        s.phantomDappSecretKeyB58 == null) {
      errorMessage = '请先连接 Phantom 钱包';
      notifyListeners();
      return;
    }
    busy = true;
    errorMessage = null;
    _onSuccess = onSuccess;
    notifyListeners();
    try {
      final encryptedJson = phantomEncryptSignTransactionPayload(
        dappSecretKeyB58: s.phantomDappSecretKeyB58!,
        phantomWalletPubkeyB58: s.phantomWalletPubkeyB58!,
        session: s.phantomSessionToken!,
        transactionBytesBase64: pending.txBytesBase64,
      );
      final encrypted = jsonDecode(encryptedJson) as Map<String, dynamic>;
      final nonce = encrypted['nonce_b58'] as String? ?? '';
      final payload = encrypted['data_b58'] as String? ?? '';
      final redirect = _callbackService.buildCallbackUri(walletId: 'phantom');
      final dappPubkey = phantomDappPublicKeyB58 ?? s.phantomDappPublicKeyB58 ?? '';
      final deeplink = mode == PhantomSubmitMode.signAndSend
          ? _deepLinkService.buildPhantomSignAndSendTransactionUri(
              dappEncryptionPublicKeyB58: dappPubkey,
              nonceB58: nonce,
              payloadB58: payload,
              redirectUri: redirect,
            )
          : _deepLinkService.buildPhantomSignTransactionUri(
              dappEncryptionPublicKeyB58: dappPubkey,
              nonceB58: nonce,
              payloadB58: payload,
              redirectUri: redirect,
            );
      _pendingTxBytesBase64 = pending.txBytesBase64;
      _pendingDescription = pending.description;
      _pendingSender = sender;
      _pendingSponsorSignature = pending.sponsorSignature;
      _pendingGasOwner = pending.gasOwner;
      _expectingBuySign = true;
      _expectingSignAndSend =
          mode == PhantomSubmitMode.signAndSend && !pending.isSponsored;
      statusMessage = '等待 Phantom 确认: ${pending.description} (${_pendingDescription ?? pending.description})';
      notifyListeners();
      await _openExternal(deeplink);
    } catch (e) {
      errorMessage = '提交交易失败: $e';
      _clearPending();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> handleCallbackUri(String raw) async {
    busy = true;
    errorMessage = null;
    notifyListeners();
    try {
      final result = _callbackService.parse(raw);
      if (!result.success) {
        statusMessage = result.message;
        return;
      }
      if (result.walletId == 'phantom') {
        await _handlePhantomPayload(result);
      }
    } catch (e) {
      errorMessage = '处理回调失败: $e';
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> disconnect() async {
    await _sessionStore.clear();
    session = null;
    phantomDappSecretKeyB58 = null;
    phantomDappPublicKeyB58 = null;
    _clearPending();
    statusMessage = '已断开钱包';
    notifyListeners();
  }

  Future<void> _handlePhantomPayload(WalletCallbackResult result) async {
    final nonce = result.queryParameters['nonce'];
    final data = result.queryParameters['data'];
    final walletPubkey =
        result.queryParameters['phantom_encryption_public_key'] ??
        result.queryParameters['public_key'];
    final dappSecret = phantomDappSecretKeyB58 ?? session?.phantomDappSecretKeyB58;
    if (nonce == null ||
        data == null ||
        walletPubkey == null ||
        dappSecret == null ||
        dappSecret.isEmpty) {
      return;
    }

    final plainJson = phantomDecryptPayload(
      dappSecretKeyB58: dappSecret,
      phantomWalletPubkeyB58: walletPubkey,
      nonceB58: nonce,
      dataB58: data,
    );
    final map = jsonDecode(plainJson) as Map<String, dynamic>;
    final sessionToken = map['session'] as String?;
    final walletSignPubkey =
        map['public_key'] as String? ?? map['publicKey'] as String?;

    if (sessionToken != null && walletSignPubkey != null) {
      final address = phantomPublicKeyToSuiAddress(pubkeyB58: walletSignPubkey);
      final next = WalletSession(
        walletId: 'phantom',
        address: address,
        connectedAtEpochMs: DateTime.now().millisecondsSinceEpoch,
        phantomSessionToken: sessionToken,
        phantomWalletPubkeyB58: walletSignPubkey,
        phantomDappSecretKeyB58: dappSecret,
        phantomDappPublicKeyB58: phantomDappPublicKeyB58,
      );
      session = next;
      await _sessionStore.save(next);
      statusMessage = 'Phantom 已连接: ${_shortAddress(address)}';
      return;
    }

    if (!_expectingBuySign) {
      return;
    }

    final signedTxB58 = map['transaction'] as String?;
    final signature =
        map['signature'] as String? ?? map['signature_b64'] as String?;

    if (_expectingSignAndSend) {
      final digest = _extractDigest(map, signature, signedTxB58);
      statusMessage = digest != null
          ? '交易成功: ${_shortDigest(digest)}'
          : 'Phantom 已广播（未返回 digest）';
      await _onSuccess?.call(digest ?? 'ok');
      _clearPending();
      return;
    }

    final pending = _pendingTxBytesBase64;
    if (pending == null) {
      errorMessage = '缺少 pending 交易';
      return;
    }
    String digest;
    if (signature != null && signature.isNotEmpty) {
      final signatures = <String>[signature];
      final sponsor = _pendingSponsorSignature;
      final gasOwner = _pendingGasOwner;
      final sender = _pendingSender;
      if (sponsor != null &&
          sponsor.isNotEmpty &&
          gasOwner != null &&
          sender != null &&
          gasOwner.toLowerCase() != sender.toLowerCase()) {
        signatures.add(sponsor);
      }
      digest = await _tx.executeWithSignatures(
        txBytesBase64: pending,
        signatures: signatures,
      );
    } else if (signedTxB58 != null && signedTxB58.isNotEmpty) {
      final signedBytesB64 = base58ToBase64(inputB58: signedTxB58);
      digest = await _tx.executeSignedBlock(txBytesBase64: signedBytesB64);
    } else {
      throw Exception('回调缺少 signature 或 transaction');
    }
    statusMessage = '交易成功: ${_shortDigest(digest)}';
    await _onSuccess?.call(digest);
    _clearPending();
  }

  void _clearPending() {
    _pendingTxBytesBase64 = null;
    _pendingDescription = null;
    _pendingSender = null;
    _pendingSponsorSignature = null;
    _pendingGasOwner = null;
    _expectingBuySign = false;
    _expectingSignAndSend = false;
    _onSuccess = null;
  }

  String? _extractDigest(
    Map<String, dynamic> map,
    String? signature,
    String? signedTxB58,
  ) {
    for (final key in ['digest', 'hash', 'txHash', 'transaction_hash']) {
      final value = map[key];
      if (value is String && value.isNotEmpty) {
        return value;
      }
    }
    return signature ?? signedTxB58;
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.parse(url);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      throw Exception('无法打开 Phantom，请确认已安装钱包');
    }
  }

  static String _shortAddress(String address) {
    if (address.length <= 12) {
      return address;
    }
    return '${address.substring(0, 6)}…${address.substring(address.length - 4)}';
  }

  static String _shortDigest(String digest) {
    if (digest.length <= 16) {
      return digest;
    }
    return '${digest.substring(0, 16)}…';
  }
}
