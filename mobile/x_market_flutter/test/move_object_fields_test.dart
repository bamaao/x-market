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

import 'package:flutter_test/flutter_test.dart';
import 'package:x_market_flutter/src/models/owned_models.dart';
import 'package:x_market_flutter/src/utils/move_object_fields.dart';

void main() {
  group('parseMoveObjectId', () {
    test('parses plain hex string', () {
      expect(
        parseMoveObjectId('0xabc123'),
        '0xabc123',
      );
    });

    test('parses nested id object', () {
      expect(
        parseMoveObjectId({'id': '0xdeadbeef'}),
        '0xdeadbeef',
      );
    });

    test('returns null for empty or missing', () {
      expect(parseMoveObjectId(null), isNull);
      expect(parseMoveObjectId(''), isNull);
      expect(parseMoveObjectId({}), isNull);
    });
  });

  group('owned snapshots', () {
    test('PositionSnapshot reads market_id as poolId', () {
      final p = PositionSnapshot.fromFields('0xpos', {
        'contract_kind': 1,
        'interval_a': 0,
        'interval_b': 1,
        'stake_usdc': '1000000',
        'claimed': false,
        'market_id': {'id': '0xpool99'},
      });
      expect(p.poolId, '0xpool99');
    });

    test('LpShareSnapshot reads market_id', () {
      final lp = LpShareSnapshot.fromFields('0xlp', {
        'shares': 5000000,
        'market_id': {'id': '0xpool77'},
      });
      expect(lp.poolId, '0xpool77');
    });

    test('MarginAccountSnapshot reads market_id and linked count', () {
      final m = MarginAccountSnapshot.fromFields('0xma', {
        'market_id': {'id': '0xpool55'},
        'gross_stake_usdc': 2000000,
        'linked_positions': [
          {'id': '0xa'},
          {'id': '0xb'},
        ],
        'liability_by_slot': [0, 100000, 500000, 200000],
      });
      expect(m.poolId, '0xpool55');
      expect(m.positionCount, 2);
      expect(m.grossStakeUsdcMist, 2000000);
      expect(m.worstLiabilityMist, 500000);
    });
  });

  test('poolIdsMatch is case-insensitive', () {
    expect(poolIdsMatch('0xABC', '0xabc'), isTrue);
    expect(poolIdsMatch('0xABC', '0xdef'), isFalse);
  });
}
