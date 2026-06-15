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

// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'X-Market';

  @override
  String get navMarkets => 'Markets';

  @override
  String get navPositions => 'Positions';

  @override
  String get navLp => 'LP';

  @override
  String get navProphet => 'Prophet';

  @override
  String get navMargin => 'Margin';

  @override
  String get navWallet => 'Wallet';

  @override
  String get indexerOfflineUsingSeeds =>
      'Indexer offline · using seed pool config';

  @override
  String get indexerApiLive => 'Indexer API live sync';

  @override
  String get seedsNoIndexerMetadata =>
      'Seed pool config (no Indexer metadata match)';

  @override
  String collateralUsdcFee(String amount, int feeBps) {
    return 'Collateral $amount USDC · fee $feeBps bps';
  }

  @override
  String get connectPhantomToTrade => 'Connect Phantom wallet to trade';

  @override
  String get connect => 'Connect';

  @override
  String get noPositions => 'No positions yet';

  @override
  String get claimed => 'Claimed';

  @override
  String get missingPoolId =>
      'Cannot link pool ID (on-chain market_id missing)';

  @override
  String get claimPayout => 'Claim payout';

  @override
  String get noLpShares => 'No LP shares yet';

  @override
  String lpShares(String amount) {
    return 'Shares $amount';
  }

  @override
  String get redeemLp => 'Redeem LP';

  @override
  String get phantomWallet => 'Phantom Wallet';

  @override
  String get notConnectedTestnet => 'Not connected · Testnet';

  @override
  String get disconnect => 'Disconnect';

  @override
  String get connectPhantom => 'Connect Phantom';

  @override
  String get testnetUsdcHint =>
      'Get testnet USDC from the Circle faucet or transfer to your wallet';

  @override
  String get refreshBalanceAndAssets => 'Refresh balance & assets';

  @override
  String recentTx(String message) {
    return 'Recent: $message';
  }

  @override
  String testnetYear(int year) {
    return 'Testnet · $year';
  }

  @override
  String get crossMarginVarTitle => 'Cross-Margin VaR (estimate)';

  @override
  String crossMarginVarWithPositions(int count) {
    return 'Aggregated worst-case across $count positions, 15 outcome slots';
  }

  @override
  String get crossMarginVarDefault =>
      'Aggregated worst-case across 15 outcome slots';

  @override
  String get marginVarSubtitle =>
      'Wallet portfolio estimate; on-chain liability applies after registration';

  @override
  String get marketForOpenAccount => 'Market (open account)';

  @override
  String get openMarginAccount => 'Open margin account';

  @override
  String get marginAccountIdHint => 'Tap an account card below to auto-fill';

  @override
  String get positionSamePool => 'Position (same pool)';

  @override
  String get registerPosition => 'Register position';

  @override
  String get unregisterPosition => 'Unregister';

  @override
  String marginAccountSummary(
    int count,
    String gross,
    String worst,
    String id,
  ) {
    return 'Positions $count · Gross $gross USDC · Worst $worst USDC\n$id';
  }

  @override
  String get tabTrade => 'Trade';

  @override
  String get tabAuction => 'Auction';

  @override
  String get gasStationEnabled =>
      'Gas Station enabled: sponsor pays gas (USDC still from your wallet)';

  @override
  String get gasStationOffline =>
      'Gas Station offline: gas deducted from wallet SUI';

  @override
  String get outcome012 => 'Outcome 0/1/2';

  @override
  String get contractType => 'Contract type';

  @override
  String get stakeUsdc => 'Stake (USDC)';

  @override
  String get lowerBoundPermille => 'Lower bound ‰';

  @override
  String get upperBoundPermille => 'Upper bound ‰';

  @override
  String get lowerBound => 'Lower bound';

  @override
  String get upperBound => 'Upper bound';

  @override
  String get threshold => 'Threshold';

  @override
  String get strikeK => 'Strike K';

  @override
  String get barrierB => 'Barrier B';

  @override
  String get subscribeUsdc => 'Subscribe USDC';

  @override
  String get lpSubscribe => 'LP subscribe';

  @override
  String get auctionNotSupported =>
      'Opening Auction not supported for this market';

  @override
  String get bucketIndex => 'Bucket index';

  @override
  String get bidUsdc => 'Bid USDC';

  @override
  String get auctionBid => 'Place auction bid';

  @override
  String get finalizeAuction => 'Finalize auction';

  @override
  String get quoteBetaUnsupported =>
      'Quote preview: Beta / exotic contracts not supported by Pricing Engine';

  @override
  String get quoteUnavailable =>
      'Quote preview unavailable (Pricing Engine offline or not configured)';

  @override
  String get quoteTitle => 'Quote preview (off-chain estimate)';

  @override
  String quoteWinProb(String percent) {
    return 'Win probability ~ $percent%';
  }

  @override
  String quotePayout(String amount) {
    return 'Payout if hit ~ $amount USDC';
  }

  @override
  String quoteImpliedRoi(String roi) {
    return 'Implied ROI $roi%';
  }

  @override
  String get buyWithGasSponsor => 'Sign with Phantom & buy (gas sponsored)';

  @override
  String get buyWithPhantom => 'Sign with Phantom & buy';

  @override
  String get contractInterval => 'Interval';

  @override
  String get contractDigital => 'Digital option';

  @override
  String get contractLinearCall => 'Linear Call';

  @override
  String get contractLinearPut => 'Linear Put';

  @override
  String get tabPublish => 'Publish';

  @override
  String get tabLeaderboard => 'Leaderboard';

  @override
  String get selectMarket => 'Please select a market';

  @override
  String get cannotSubmit => 'Cannot submit';

  @override
  String get fillAnalysis => 'Please enter analysis content';

  @override
  String get predictedValueMustBeInt => 'Predicted value must be an integer';

  @override
  String get committingProphecy => 'Uploading to Indexer → on-chain Commit…';

  @override
  String myStats(int wins, int losses, String score, int audited) {
    return 'My record: ${wins}W ${losses}L · Score $score · Audited $audited';
  }

  @override
  String get targetMarket => 'Target market';

  @override
  String get predictedValue => 'Predicted value';

  @override
  String predictedValueHelper(String kind) {
    return 'Same settlement unit as $kind distribution';
  }

  @override
  String get exclusiveAnalysis => 'Exclusive analysis (plaintext)';

  @override
  String get mobileP3Hint =>
      'Mobile P3: public practice only (unlock_price=0). Paid Seal predictions use Web /prophet.';

  @override
  String get processing => 'Processing…';

  @override
  String get commitPublicProphecy =>
      'Indexer plaintext → Commit public prediction';

  @override
  String get poolProphecies => 'Predictions for this market';

  @override
  String get noProphecies => 'No predictions yet';

  @override
  String get selectProphecy => 'Select prediction';

  @override
  String prophecyStatus(String status) {
    return 'Status: $status';
  }

  @override
  String prophecyValue(String value) {
    return 'Predicted value: $value';
  }

  @override
  String get prophecyPublicReadable => 'Publicly readable';

  @override
  String get prophecyPrivateWeb => 'Private (unlock via Web / Seal)';

  @override
  String get analysisContent => 'Analysis content';

  @override
  String get leaderboardEmpty => 'Indexer offline or no leaderboard data';

  @override
  String leaderboardMe(String address) {
    return 'Me ($address…)';
  }

  @override
  String leaderboardRow(int wins, int losses, String score, String paid) {
    return '${wins}W ${losses}L · Score $score$paid';
  }

  @override
  String get paidUnlockEnabled => ' · Paid unlock enabled';

  @override
  String get prophecyStatusOpen => 'Open';

  @override
  String get prophecyStatusWin => 'Audited · Win';

  @override
  String get prophecyStatusLoss => 'Audited · Loss';

  @override
  String get prophecyStatusCheat => 'Cheat';

  @override
  String prophecyStatusUnknown(int status) {
    return 'Unknown ($status)';
  }

  @override
  String paidUnlockHintNew(int minAudited, String minScore) {
    return 'New prophets must publish free predictions (unlock_price=0), complete ≥$minAudited audits with Score ≥ $minScore before paid unlock';
  }

  @override
  String get paidUnlockHintCheat =>
      'Cheat record found; paid unlock unavailable';

  @override
  String paidUnlockHintProgress(int audited, int required) {
    return 'Audited $audited/$required; keep publishing free predictions to build record';
  }

  @override
  String paidUnlockHintScore(String score, String minScore) {
    return 'Prophet Score $score, need ≥ $minScore for paid unlock';
  }

  @override
  String get paidUnlockHintEligible =>
      'Eligible for paid unlock (unlock_price > 0). Use Web App for Seal encrypted predictions on Mobile';

  @override
  String get eligibilityNoPoolId => 'Pool ID not configured';

  @override
  String get eligibilityMarketResolved => 'Market settled; predictions closed';

  @override
  String get eligibilityMarketPaused => 'Market paused';

  @override
  String get eligibilityExpired => 'Past maturity; predictions closed';

  @override
  String eligibilityTooClose(int minutes) {
    return 'Less than $minutes min to maturity; predictions closed';
  }

  @override
  String get eligibilityCanCommit =>
      'Public prediction allowed (unlock_price=0)';

  @override
  String get connectWalletFirst => 'Please connect wallet first';

  @override
  String gasSponsorFallback(String error) {
    return 'Gas sponsor unavailable, paying gas yourself: $error';
  }

  @override
  String get unknownMarket => 'Unknown market';

  @override
  String get walletSessionRestored => 'Phantom session restored';

  @override
  String get openingPhantom => 'Opening Phantom…';

  @override
  String connectPhantomFailed(String error) {
    return 'Failed to connect Phantom: $error';
  }

  @override
  String get connectPhantomWalletFirst => 'Please connect Phantom wallet first';

  @override
  String waitingPhantomConfirm(String description) {
    return 'Waiting for Phantom: $description';
  }

  @override
  String submitTxFailed(String error) {
    return 'Failed to submit transaction: $error';
  }

  @override
  String callbackFailed(String error) {
    return 'Failed to handle callback: $error';
  }

  @override
  String get walletDisconnected => 'Wallet disconnected';

  @override
  String phantomConnected(String address) {
    return 'Phantom connected: $address';
  }

  @override
  String txSuccess(String digest) {
    return 'Transaction success: $digest';
  }

  @override
  String get phantomBroadcastNoDigest =>
      'Phantom broadcast (no digest returned)';

  @override
  String get missingPendingTx => 'Missing pending transaction';

  @override
  String get cannotOpenPhantom =>
      'Cannot open Phantom; confirm the wallet app is installed';

  @override
  String get txClaimPosition => 'Claim position';

  @override
  String get txLpDeposit => 'LP deposit';

  @override
  String get txLpWithdraw => 'LP withdraw';

  @override
  String get txAuctionBid => 'Auction bid';

  @override
  String get txFinalizeAuction => 'Finalize auction';

  @override
  String get txOpenMarginAccount => 'Open margin account';

  @override
  String get txRegisterPosition => 'Register position';

  @override
  String get txUnregisterPosition => 'Unregister position';

  @override
  String get txCommitProphecy => 'Commit public prediction';

  @override
  String get errInvalidAmount => 'Invalid amount';

  @override
  String errMaxDecimals(int decimals) {
    return 'At most $decimals decimal places';
  }

  @override
  String get errAmountMustBePositive => 'Amount must be greater than 0';

  @override
  String get errNoUsdcInWallet =>
      'No USDC in wallet — transfer or claim testnet USDC first';

  @override
  String errInsufficientUsdc(String need, String have) {
    return 'Insufficient USDC: need $need, have $have';
  }

  @override
  String get errStructuredNoteCap => 'Structured Note requires C > K';

  @override
  String get errRangeNoteBounds => 'Range Note requires U >= L';

  @override
  String errUnsupportedMarketKind(String kind) {
    return 'Unsupported market type: $kind';
  }

  @override
  String get errNoDigest => 'Transaction succeeded but no digest returned';

  @override
  String get errProphetRegistryNotConfigured =>
      'ProphetRegistry not configured';

  @override
  String get errIndexerNotConfigured => 'Indexer is not configured';

  @override
  String get errEmptyPoolId => 'pool_id is empty';

  @override
  String get errEmptyBlob => 'Empty blob';

  @override
  String get errBlobTooLarge => 'Blob exceeds 512KB limit';

  @override
  String errIndexerUploadFailed(int status, String body) {
    return 'Indexer upload failed ($status): $body';
  }

  @override
  String get errInvalidIndexerResponse => 'Invalid Indexer response';

  @override
  String get errMissingBlobId => 'Indexer response missing blob_id';

  @override
  String errIndexerBlobReadFailed(int status) {
    return 'Indexer blob read failed ($status)';
  }

  @override
  String errIpfsReadFailed(int status) {
    return 'IPFS read failed ($status)';
  }

  @override
  String get errUnsupportedBlobId => 'Unsupported blob_id (need idx: or ipfs:)';

  @override
  String get errGasStationNotConfigured => 'Gas Station is not configured';

  @override
  String errGasStationHttpError(String error) {
    return 'Gas Station error: $error';
  }

  @override
  String get errGasStationInvalidResponse => 'Invalid Gas Station response';

  @override
  String get errInvalidAddress => 'Invalid address (expected 0x hex)';

  @override
  String errRpcHttpFailed(int status) {
    return 'RPC request failed: HTTP $status';
  }

  @override
  String errRpcError(String error) {
    return 'RPC error: $error';
  }

  @override
  String get errRpcInvalidResponse => 'Invalid RPC response';

  @override
  String errRpcMissingField(String field) {
    return 'Missing RPC field: $field';
  }

  @override
  String get errCallbackMissingSigOrTx =>
      'Callback missing signature or transaction';

  @override
  String get seedPoissonGoalsTitle => 'Total goals · Poisson';

  @override
  String get seedDirichletWdlTitle => 'Win / Draw / Loss · Dirichlet';

  @override
  String get seedNormalCpiTitle => 'CPI range · Normal';

  @override
  String get seedBetaVoteTitle => 'Vote share · Beta';
}
