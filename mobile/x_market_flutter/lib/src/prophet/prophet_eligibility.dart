import 'package:x_market_flutter/src/models/sui_models.dart';

const prophetUnlockCutoffSecs = 300;

enum ProphetMarketStatus { open, closing, expired, resolved, paused, noPool }

class ProphetMarketEligibility {
  const ProphetMarketEligibility({
    required this.status,
    required this.canCommit,
    required this.reason,
    this.remainingSecs,
  });

  final ProphetMarketStatus status;
  final bool canCommit;
  final String reason;
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
      reason: '未配置 Pool ID',
    );
  }
  if (resolved || market.status == 2) {
    return const ProphetMarketEligibility(
      status: ProphetMarketStatus.resolved,
      canCommit: false,
      reason: '市场已结算，不可再提交预测',
    );
  }
  if (market.paused) {
    return ProphetMarketEligibility(
      status: ProphetMarketStatus.paused,
      canCommit: false,
      reason: '市场已暂停',
      remainingSecs: maturityTs > nowSec ? maturityTs - nowSec : 0,
    );
  }
  if (maturityTs <= nowSec) {
    return const ProphetMarketEligibility(
      status: ProphetMarketStatus.expired,
      canCommit: false,
      reason: '已过到期时间，不可提交预测',
      remainingSecs: 0,
    );
  }
  final remaining = maturityTs - nowSec;
  if (remaining <= prophetUnlockCutoffSecs) {
    return ProphetMarketEligibility(
      status: ProphetMarketStatus.closing,
      canCommit: false,
      reason: '距到期不足 ${prophetUnlockCutoffSecs ~/ 60} 分钟，不可提交预测',
      remainingSecs: remaining,
    );
  }
  return ProphetMarketEligibility(
    status: ProphetMarketStatus.open,
    canCommit: true,
    reason: '可提交公开预测（unlock_price=0）',
    remainingSecs: remaining,
  );
}
