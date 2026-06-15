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
