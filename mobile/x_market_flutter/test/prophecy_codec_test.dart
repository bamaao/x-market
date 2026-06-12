import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:x_market_flutter/src/prophet/prophecy_codec.dart';

void main() {
  test('canonicalProphecyJson stable key order', () {
    final json = canonicalProphecyJson(
      buildProphecyPayload(
        marketId: '0xabc',
        predictedValue: 7,
        analysis: 'test',
      ),
    );
    expect(json, contains('"market_id":"0xabc"'));
    expect(json, contains('"predicted_value":7'));
  });

  test('hashProphecyPlaintext returns 32 bytes', () {
    final hash = hashProphecyPlaintext(
      buildProphecyPayload(
        marketId: '0xabc',
        predictedValue: 2,
        analysis: 'hello',
      ),
    );
    expect(hash.length, 32);
    expect(bytesToHex(hash), hasLength(64));
  });

  test('parseProphecyPlaintextJson roundtrip', () {
    final payload = buildProphecyPayload(
      marketId: '0xpool',
      predictedValue: 3,
      analysis: 'analysis text',
    );
    final content = parseProphecyPlaintextJson(canonicalProphecyJson(payload));
    expect(content.payload.marketId, '0xpool');
    expect(content.analysis, 'analysis text');
  });
}
