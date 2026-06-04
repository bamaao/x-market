import 'package:x_market_flutter/src/utils/move_object_fields.dart';

class PositionSnapshot {
  PositionSnapshot({
    required this.objectId,
    required this.contractKind,
    required this.intervalA,
    required this.intervalB,
    required this.stakeUsdcMist,
    required this.claimed,
    this.marketId,
    this.entryProbPpb = 0,
  });

  final String objectId;
  final int contractKind;
  final int intervalA;
  final int intervalB;
  final int stakeUsdcMist;
  final bool claimed;
  final String? marketId;
  final int entryProbPpb;

  /// On-chain `Position.market_id` is the MarketPool object ID.
  String? get poolId => marketId;

  String get kindLabel {
    return switch (contractKind) {
      1 => 'Digital',
      2 => 'Linear Call',
      3 => 'Linear Put',
      4 => 'Straddle',
      5 => 'Variance Swap',
      6 => 'Structured Note',
      7 => 'Range Note',
      8 => 'Barrier Note',
      _ => 'Interval',
    };
  }

  factory PositionSnapshot.fromFields(String objectId, Map<String, dynamic> f) {
    return PositionSnapshot(
      objectId: objectId,
      contractKind: _asInt(f['contract_kind']),
      intervalA: _asInt(f['interval_a']),
      intervalB: _asInt(f['interval_b']),
      stakeUsdcMist: parseInt(f['stake_usdc']),
      claimed: f['claimed'] == true,
      marketId: parseMoveObjectId(f['market_id']),
      entryProbPpb: parseInt(f['entry_prob_ppb']),
    );
  }

  static int parseInt(dynamic v) {
    return _asInt(v);
  }

  static int _asInt(dynamic v) {
    if (v is int) {
      return v;
    }
    if (v is String) {
      return int.tryParse(v) ?? 0;
    }
    return 0;
  }
}

class LpShareSnapshot {
  LpShareSnapshot({
    required this.objectId,
    required this.shares,
    required this.poolId,
  });

  final String objectId;
  final int shares;
  final String? poolId;

  factory LpShareSnapshot.fromFields(String objectId, Map<String, dynamic> f) {
    return LpShareSnapshot(
      objectId: objectId,
      shares: PositionSnapshot.parseInt(f['shares']),
      poolId: parseMoveObjectId(f['market_id']),
    );
  }
}

class MarginAccountSnapshot {
  MarginAccountSnapshot({
    required this.objectId,
    required this.poolId,
    required this.positionCount,
    required this.grossStakeUsdcMist,
    required this.worstLiabilityMist,
  });

  final String objectId;
  final String? poolId;
  final int positionCount;
  final int grossStakeUsdcMist;
  final int worstLiabilityMist;

  factory MarginAccountSnapshot.fromFields(
    String objectId,
    Map<String, dynamic> f,
  ) {
    return MarginAccountSnapshot(
      objectId: objectId,
      poolId: parseMoveObjectId(f['market_id']),
      positionCount: parseLinkedPositionCount(f),
      grossStakeUsdcMist: PositionSnapshot.parseInt(f['gross_stake_usdc']),
      worstLiabilityMist: parseWorstLiabilityMist(f),
    );
  }
}
