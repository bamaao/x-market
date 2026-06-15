import 'package:x_market_flutter/src/models/sui_models.dart';

const prophetUnlockCutoffSecs = 300;

enum ProphetMarketStatus { open, closing, expired, resolved, paused, noPool }

enum ProphetEligibilityReason {
  noPoolId,
  marketResolved,
  marketPaused,
  expired,
  tooCloseToMaturity,
  canCommitPublic,
}

class ProphetMarketEligibility {
  const ProphetMarketEligibility({
    required this.status,
    required this.canCommit,
    required this.reason,
    this.remainingSecs,
  });

  final ProphetMarketStatus status;
  final bool canCommit;
  final ProphetEligibilityReason reason;
  final int? remainingSecs;
}

ProphetMarketEligibility assessProphetMarketEligibility({
  required int nowSec,
  required MarketPoolSnapshot market,
  bool resolved = false,
}) {
  final poolId = market.poolId;
  final maturityTs = market.maturityTs;

  if (poolId.isEmpty) {
    return const ProphetMarketEligibility(
      status: ProphetMarketStatus.noPool,
      canCommit: false,
      reason: ProphetEligibilityReason.noPoolId,
    );
  }
  if (resolved || market.status == 2) {
    return const ProphetMarketEligibility(
      status: ProphetMarketStatus.resolved,
      canCommit: false,
      reason: ProphetEligibilityReason.marketResolved,
    );
  }
  if (market.paused) {
    return ProphetMarketEligibility(
      status: ProphetMarketStatus.paused,
      canCommit: false,
      reason: ProphetEligibilityReason.marketPaused,
      remainingSecs: maturityTs > nowSec ? maturityTs - nowSec : 0,
    );
  }
  if (maturityTs <= nowSec) {
    return const ProphetMarketEligibility(
      status: ProphetMarketStatus.expired,
      canCommit: false,
      reason: ProphetEligibilityReason.expired,
      remainingSecs: 0,
    );
  }
  final remaining = maturityTs - nowSec;
  if (remaining <= prophetUnlockCutoffSecs) {
    return ProphetMarketEligibility(
      status: ProphetMarketStatus.closing,
      canCommit: false,
      reason: ProphetEligibilityReason.tooCloseToMaturity,
      remainingSecs: remaining,
    );
  }
  return ProphetMarketEligibility(
    status: ProphetMarketStatus.open,
    canCommit: true,
    reason: ProphetEligibilityReason.canCommitPublic,
    remainingSecs: remaining,
  );
}
