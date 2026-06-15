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

import 'package:x_market_flutter/src/models/owned_models.dart';

const _outcomeSlots = 15;
const _linearCallKind = 2;
const _linearPutKind = 3;
const _straddleKind = 4;
const _varianceSwapKind = 5;
const _structuredNoteKind = 6;
const _rangeNoteKind = 7;
const _barrierNoteKind = 8;

/// Front-end Cross-Margin VaR estimate (mirrors Web `positions/page.tsx`).
int estimateCrossMarginVar(List<PositionSnapshot> positions) {
  var worst = 0;
  for (var slot = 0; slot < _outcomeSlots; slot++) {
    var scenario = 0;
    for (final p in positions) {
      scenario += _positionPayoutAtSlot(p, slot);
    }
    if (scenario > worst) {
      worst = scenario;
    }
  }
  return worst;
}

int _positionPayoutAtSlot(PositionSnapshot p, int slot) {
  final stake = p.stakeUsdcMist;
  switch (p.contractKind) {
    case _linearCallKind:
      final diff = slot > p.intervalA ? slot - p.intervalA : 0;
      return (stake * diff) ~/ 10;
    case _linearPutKind:
      final diff = slot < p.intervalA ? p.intervalA - slot : 0;
      return (stake * diff) ~/ 10;
    case _straddleKind:
      final diff = (slot - p.intervalA).abs();
      return (stake * diff) ~/ 10;
    case _varianceSwapKind:
      final d = (slot - p.intervalA).abs();
      return (stake * d * d) ~/ 10;
    case _structuredNoteKind:
      final uncapped = slot > p.intervalA ? slot - p.intervalA : 0;
      final cap = p.intervalB > p.intervalA ? p.intervalB - p.intervalA : 0;
      final diff = uncapped > cap ? cap : uncapped;
      return (stake * diff) ~/ 10;
    case _rangeNoteKind:
      if (slot >= p.intervalA && slot <= p.intervalB) {
        return stake;
      }
      return 0;
    case _barrierNoteKind:
      if (slot >= p.intervalA) {
        return stake;
      }
      return 0;
    default:
      if (p.entryProbPpb > 0) {
        final inRange = slot >= p.intervalA && slot <= p.intervalB;
        if (inRange) {
          return (stake * 1000000000) ~/ p.entryProbPpb;
        }
      }
      return 0;
  }
}
