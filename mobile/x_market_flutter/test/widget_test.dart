import 'package:flutter_test/flutter_test.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/app/x_market_app.dart';
import 'package:x_market_flutter/src/rust/frb_generated.dart';

class _MockRustApi extends RustLibApi {
  @override
  String crateApiSimpleGreet({required String name}) => 'Hello, $name!';

  @override
  String crateApiWalletDeriveSuiAddressFromPrivateKeyHex({
    required String privateKeyHex,
  }) {
    return '0x1111111111111111111111111111111111111111111111111111111111111111';
  }

  @override
  String crateApiPhantomPhantomDecryptPayload({
    required String dappSecretKeyB58,
    required String phantomWalletPubkeyB58,
    required String nonceB58,
    required String dataB58,
  }) => '{}';

  @override
  String crateApiPhantomPhantomEncryptSignMessagePayload({
    required String dappSecretKeyB58,
    required String phantomWalletPubkeyB58,
    required String session,
    required String messageUtf8,
  }) => '{"nonce_b58":"nonce","data_b58":"data"}';

  @override
  String crateApiPhantomPhantomEncryptSignTransactionPayload({
    required String dappSecretKeyB58,
    required String phantomWalletPubkeyB58,
    required String session,
    required String transactionBytesBase64,
  }) => '{"nonce_b58":"nonce","data_b58":"data"}';

  @override
  String crateApiPhantomBase58ToBase64({required String inputB58}) =>
      'dGVzdA==';

  @override
  String crateApiPhantomPhantomGenerateDappEncryptionKeypair() =>
      '{"public_key_b58":"pub","secret_key_b58":"sec"}';

  @override
  String crateApiPhantomPhantomPublicKeyToSuiAddress({
    required String pubkeyB58,
  }) => '0x1111111111111111111111111111111111111111111111111111111111111111';

  @override
  bool crateApiPhantomPhantomVerifySignMessage({
    required String pubkeyB58,
    required String messageUtf8,
    required String signatureB58,
  }) => true;

  @override
  Future<void> crateApiSimpleInitApp() async {}
}

void main() {
  setUpAll(() {
    RustLib.initMock(api: _MockRustApi());
  });

  testWidgets('App shell shows markets tab', (WidgetTester tester) async {
    final app = AppController();
    await tester.pumpWidget(XMarketApp(controller: app));
    await tester.pumpAndSettle();

    expect(find.text('X-Market'), findsWidgets);
    expect(find.text('市场'), findsOneWidget);
  });
}
