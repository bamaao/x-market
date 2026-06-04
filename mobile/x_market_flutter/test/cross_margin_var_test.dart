import 'package:flutter_test/flutter_test.dart';
import 'package:x_market_flutter/src/models/owned_models.dart';
import 'package:x_market_flutter/src/risk/cross_margin_var.dart';

PositionSnapshot _pos({
  required int kind,
  required int intervalA,
  int intervalB = 0,
  required int stake,
  int entryProbPpb = 0,
}) {
  return PositionSnapshot(
    objectId: '0x1',
    contractKind: kind,
    intervalA: intervalA,
    intervalB: intervalB,
    stakeUsdcMist: stake,
    claimed: false,
    entryProbPpb: entryProbPpb,
  );
}

void main() {
  test('interval position uses entry_prob_ppb payout', () {
    // stake 1 USDC, entry 50% -> payout 2 USDC in winning slots
    final varMist = estimateCrossMarginVar([
      _pos(
        kind: 0,
        intervalA: 5,
        intervalB: 7,
        stake: 1000000,
        entryProbPpb: 500000000,
      ),
    ]);
    expect(varMist, 2000000);
  });

  test('linear call worst at far slot', () {
    final varMist = estimateCrossMarginVar([
      _pos(kind: 2, intervalA: 5, stake: 1000000),
    ]);
    // max diff at slot 14 -> (14-5)=9 -> 1M * 9 / 10 = 900_000
    expect(varMist, 900000);
  });

  test('straddle peaks at strike', () {
    final varMist = estimateCrossMarginVar([
      _pos(kind: 4, intervalA: 7, stake: 1000000),
    ]);
    // max |slot-7| at 0 or 14 -> 7 -> 1M * 7 / 10 = 700_000
    expect(varMist, 700000);
  });

  test('variance swap grows quadratically', () {
    final varMist = estimateCrossMarginVar([
      _pos(kind: 5, intervalA: 7, stake: 1000000),
    ]);
    // max d=7 -> 1M * 49 / 10 = 4_900_000
    expect(varMist, 4900000);
  });

  test('range note pays full stake in band', () {
    final varMist = estimateCrossMarginVar([
      _pos(kind: 7, intervalA: 3, intervalB: 6, stake: 2000000),
    ]);
    expect(varMist, 2000000);
  });

  test('combines positions on same worst slot', () {
    final varMist = estimateCrossMarginVar([
      _pos(kind: 7, intervalA: 3, intervalB: 6, stake: 1000000),
      _pos(kind: 7, intervalA: 4, intervalB: 5, stake: 1500000),
    ]);
    // slot 4 or 5: 1M + 1.5M = 2.5M
    expect(varMist, 2500000);
  });
}
