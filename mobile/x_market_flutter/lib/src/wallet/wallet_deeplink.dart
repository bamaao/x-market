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

class WalletDeepLinkApp {
  const WalletDeepLinkApp({
    required this.id,
    required this.name,
    required this.deepLinkTemplate,
    required this.installUrl,
    this.note,
  });

  final String id;
  final String name;
  final String deepLinkTemplate;
  final String installUrl;
  final String? note;

  String buildDeepLink({
    required String dappUrl,
    required String redirectUri,
    required String network,
    Map<String, String> extras = const {},
  }) {
    final encoded = Uri.encodeComponent(dappUrl);
    final redirect = Uri.encodeComponent(redirectUri);
    var result = deepLinkTemplate
        .replaceAll('{dapp}', encoded)
        .replaceAll('{redirect}', redirect)
        .replaceAll('{network}', network);
    extras.forEach((key, value) {
      result = result.replaceAll('{$key}', Uri.encodeComponent(value));
    });
    return result;
  }
}

class WalletDeepLinkService {
  static const List<WalletDeepLinkApp> apps = [
    WalletDeepLinkApp(
      id: 'phantom',
      name: 'Phantom Wallet',
      deepLinkTemplate:
          'https://phantom.app/ul/v1/connect?app_url={dapp}&redirect_link={redirect}&cluster={network}&dapp_encryption_public_key={phantom_key}',
      installUrl: 'https://phantom.app/download',
      note: 'Phantom connect 协议模板（参数建议按官方最新文档校准）',
    ),
    WalletDeepLinkApp(
      id: 'okx',
      name: 'OKX Wallet',
      deepLinkTemplate: 'okx://wallet/dapp/url?dappUrl={dapp}',
      installUrl: 'https://www.okx.com/web3',
      note: '使用 OKX deeplink 打开 dApp。',
    ),
    WalletDeepLinkApp(
      id: 'slush',
      name: 'Slush Wallet',
      deepLinkTemplate: 'slush://dapp?url={dapp}',
      installUrl: 'https://slush.app',
      note: '示例模板，请按官方协议确认参数。',
    ),
  ];

  String buildLaunchUri({
    required WalletDeepLinkApp app,
    required String dappUrl,
    required String redirectUri,
    required String network,
    Map<String, String> extras = const {},
  }) {
    return app.buildDeepLink(
      dappUrl: dappUrl,
      redirectUri: redirectUri,
      network: network,
      extras: extras,
    );
  }

  String buildPhantomSignAndSendTransactionUri({
    required String dappEncryptionPublicKeyB58,
    required String nonceB58,
    required String payloadB58,
    required String redirectUri,
  }) {
    final key = Uri.encodeComponent(dappEncryptionPublicKeyB58);
    final nonce = Uri.encodeComponent(nonceB58);
    final payload = Uri.encodeComponent(payloadB58);
    final redirect = Uri.encodeComponent(redirectUri);
    return 'https://phantom.app/ul/v1/signAndSendTransaction'
        '?dapp_encryption_public_key=$key'
        '&nonce=$nonce'
        '&redirect_link=$redirect'
        '&payload=$payload';
  }

  String buildPhantomSignTransactionUri({
    required String dappEncryptionPublicKeyB58,
    required String nonceB58,
    required String payloadB58,
    required String redirectUri,
  }) {
    final key = Uri.encodeComponent(dappEncryptionPublicKeyB58);
    final nonce = Uri.encodeComponent(nonceB58);
    final payload = Uri.encodeComponent(payloadB58);
    final redirect = Uri.encodeComponent(redirectUri);
    return 'https://phantom.app/ul/v1/signTransaction'
        '?dapp_encryption_public_key=$key'
        '&nonce=$nonce'
        '&redirect_link=$redirect'
        '&payload=$payload';
  }

  String buildPhantomSignMessageUri({
    required String dappEncryptionPublicKeyB58,
    required String nonceB58,
    required String payloadB58,
    required String redirectUri,
  }) {
    final key = Uri.encodeComponent(dappEncryptionPublicKeyB58);
    final nonce = Uri.encodeComponent(nonceB58);
    final payload = Uri.encodeComponent(payloadB58);
    final redirect = Uri.encodeComponent(redirectUri);
    return 'https://phantom.app/ul/v1/signMessage'
        '?dapp_encryption_public_key=$key'
        '&nonce=$nonce'
        '&redirect_link=$redirect'
        '&payload=$payload';
  }
}
