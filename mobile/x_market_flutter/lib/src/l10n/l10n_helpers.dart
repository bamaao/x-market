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

import 'package:x_market_flutter/l10n/app_localizations.dart';
import 'package:x_market_flutter/src/l10n/app_exception.dart';
import 'package:x_market_flutter/src/models/prophet_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/prophet/prophet_eligibility.dart';
import 'package:x_market_flutter/src/trade/buy_transaction_service.dart';

extension ContractModeL10n on ContractMode {
  String localizedLabel(AppLocalizations l10n) => switch (this) {
    ContractMode.interval => l10n.contractInterval,
    ContractMode.digital => l10n.contractDigital,
    ContractMode.linearCall => l10n.contractLinearCall,
    ContractMode.linearPut => l10n.contractLinearPut,
    ContractMode.straddle => 'Straddle',
    ContractMode.varianceSwap => 'Variance Swap',
    ContractMode.structuredNote => 'Structured Note',
    ContractMode.rangeNote => 'Range Note',
    ContractMode.barrierNote => 'Barrier Note',
  };
}

extension ProphetEligibilityL10n on ProphetMarketEligibility {
  String localizedReason(AppLocalizations l10n) => switch (reason) {
    ProphetEligibilityReason.noPoolId => l10n.eligibilityNoPoolId,
    ProphetEligibilityReason.marketResolved => l10n.eligibilityMarketResolved,
    ProphetEligibilityReason.marketPaused => l10n.eligibilityMarketPaused,
    ProphetEligibilityReason.expired => l10n.eligibilityExpired,
    ProphetEligibilityReason.tooCloseToMaturity => l10n.eligibilityTooClose(
      prophetUnlockCutoffSecs ~/ 60,
    ),
    ProphetEligibilityReason.canCommitPublic => l10n.eligibilityCanCommit,
  };
}

String localizedProphecyStatus(AppLocalizations l10n, int status) {
  switch (status) {
    case prophecyStatusOpen:
      return l10n.prophecyStatusOpen;
    case 1:
      return l10n.prophecyStatusWin;
    case 2:
      return l10n.prophecyStatusLoss;
    case 3:
      return l10n.prophecyStatusCheat;
    default:
      return l10n.prophecyStatusUnknown(status);
  }
}

String localizedPaidUnlockHint(AppLocalizations l10n, ProphetStatsView? stats) {
  if (stats == null) {
    return l10n.paidUnlockHintNew(
      minAuditedForPaid,
      (minScoreBpsForPaid / 100).toStringAsFixed(1),
    );
  }
  if (stats.cheats > 0) {
    return l10n.paidUnlockHintCheat;
  }
  if (stats.totalAudited < minAuditedForPaid) {
    return l10n.paidUnlockHintProgress(
      stats.totalAudited,
      minAuditedForPaid,
    );
  }
  if (stats.scoreBps < minScoreBpsForPaid) {
    return l10n.paidUnlockHintScore(
      (stats.scoreBps / 100).toStringAsFixed(1),
      (minScoreBpsForPaid / 100).toStringAsFixed(1),
    );
  }
  return l10n.paidUnlockHintEligible;
}

String localizeTxDescription(AppLocalizations l10n, String description) {
  return switch (description) {
    'Claim position' => l10n.txClaimPosition,
    'LP deposit' => l10n.txLpDeposit,
    'LP withdraw' => l10n.txLpWithdraw,
    'Auction bid' => l10n.txAuctionBid,
    'Finalize auction' => l10n.txFinalizeAuction,
    'Open margin account' => l10n.txOpenMarginAccount,
    'Register position' => l10n.txRegisterPosition,
    'Unregister position' => l10n.txUnregisterPosition,
    'Commit public prediction' => l10n.txCommitProphecy,
    _ => description,
  };
}

String localizedMarketLabel(AppLocalizations l10n, MarketPoolSnapshot market) {
  return switch (market.kind) {
    'poisson' => l10n.seedPoissonGoalsTitle,
    'dirichlet' => l10n.seedDirichletWdlTitle,
    'normal' => l10n.seedNormalCpiTitle,
    'beta' => l10n.seedBetaVoteTitle,
    _ => market.label,
  };
}

String displayMarketLabel(AppLocalizations l10n, MarketPoolSnapshot market) {
  if (market.slug != null && market.slug!.isNotEmpty) {
    return market.label;
  }
  return localizedMarketLabel(l10n, market);
}

String localizeError(AppLocalizations l10n, Object error) {
  if (error is AppException) {
    return switch (error.code) {
      AppErrorCodes.invalidAmount => l10n.errInvalidAmount,
      AppErrorCodes.maxDecimals => l10n.errMaxDecimals(
        error.args['decimals'] as int? ?? ChainTransactionService.usdcDecimals,
      ),
      AppErrorCodes.amountMustBePositive => l10n.errAmountMustBePositive,
      AppErrorCodes.noUsdcInWallet => l10n.errNoUsdcInWallet,
      AppErrorCodes.insufficientUsdc => l10n.errInsufficientUsdc(
        '${error.args['need']}',
        '${error.args['have']}',
      ),
      AppErrorCodes.structuredNoteCap => l10n.errStructuredNoteCap,
      AppErrorCodes.rangeNoteBounds => l10n.errRangeNoteBounds,
      AppErrorCodes.unsupportedMarketKind => l10n.errUnsupportedMarketKind(
        '${error.args['kind']}',
      ),
      AppErrorCodes.noDigest => l10n.errNoDigest,
      AppErrorCodes.prophetRegistryNotConfigured =>
        l10n.errProphetRegistryNotConfigured,
      AppErrorCodes.indexerNotConfigured => l10n.errIndexerNotConfigured,
      AppErrorCodes.emptyPoolId => l10n.errEmptyPoolId,
      AppErrorCodes.emptyBlob => l10n.errEmptyBlob,
      AppErrorCodes.blobTooLarge => l10n.errBlobTooLarge,
      AppErrorCodes.indexerUploadFailed => l10n.errIndexerUploadFailed(
        error.args['status'] as int? ?? 0,
        '${error.args['body']}',
      ),
      AppErrorCodes.invalidIndexerResponse => l10n.errInvalidIndexerResponse,
      AppErrorCodes.missingBlobId => l10n.errMissingBlobId,
      AppErrorCodes.indexerBlobReadFailed => l10n.errIndexerBlobReadFailed(
        error.args['status'] as int? ?? 0,
      ),
      AppErrorCodes.ipfsReadFailed => l10n.errIpfsReadFailed(
        error.args['status'] as int? ?? 0,
      ),
      AppErrorCodes.unsupportedBlobId => l10n.errUnsupportedBlobId,
      AppErrorCodes.gasStationNotConfigured => l10n.errGasStationNotConfigured,
      AppErrorCodes.gasStationHttpError => l10n.errGasStationHttpError(
        '${error.args['error']}',
      ),
      AppErrorCodes.gasStationInvalidResponse =>
        l10n.errGasStationInvalidResponse,
      AppErrorCodes.invalidAddress => l10n.errInvalidAddress,
      AppErrorCodes.rpcHttpFailed => l10n.errRpcHttpFailed(
        error.args['status'] as int? ?? 0,
      ),
      AppErrorCodes.rpcError => l10n.errRpcError('${error.args['error']}'),
      AppErrorCodes.rpcInvalidResponse => l10n.errRpcInvalidResponse,
      AppErrorCodes.rpcMissingField => l10n.errRpcMissingField(
        '${error.args['field']}',
      ),
      AppErrorCodes.callbackMissingSigOrTx => l10n.errCallbackMissingSigOrTx,
      _ => error.code,
    };
  }
  final text = error.toString();
  if (text.startsWith('Exception: ')) {
    return text.substring('Exception: '.length);
  }
  return text;
}
