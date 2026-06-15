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

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('zh'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'X-Market'**
  String get appTitle;

  /// No description provided for @navMarkets.
  ///
  /// In en, this message translates to:
  /// **'Markets'**
  String get navMarkets;

  /// No description provided for @navPositions.
  ///
  /// In en, this message translates to:
  /// **'Positions'**
  String get navPositions;

  /// No description provided for @navLp.
  ///
  /// In en, this message translates to:
  /// **'LP'**
  String get navLp;

  /// No description provided for @navProphet.
  ///
  /// In en, this message translates to:
  /// **'Prophet'**
  String get navProphet;

  /// No description provided for @navMargin.
  ///
  /// In en, this message translates to:
  /// **'Margin'**
  String get navMargin;

  /// No description provided for @navWallet.
  ///
  /// In en, this message translates to:
  /// **'Wallet'**
  String get navWallet;

  /// No description provided for @indexerOfflineUsingSeeds.
  ///
  /// In en, this message translates to:
  /// **'Indexer offline · using seed pool config'**
  String get indexerOfflineUsingSeeds;

  /// No description provided for @indexerApiLive.
  ///
  /// In en, this message translates to:
  /// **'Indexer API live sync'**
  String get indexerApiLive;

  /// No description provided for @seedsNoIndexerMetadata.
  ///
  /// In en, this message translates to:
  /// **'Seed pool config (no Indexer metadata match)'**
  String get seedsNoIndexerMetadata;

  /// No description provided for @collateralUsdcFee.
  ///
  /// In en, this message translates to:
  /// **'Collateral {amount} USDC · fee {feeBps} bps'**
  String collateralUsdcFee(String amount, int feeBps);

  /// No description provided for @connectPhantomToTrade.
  ///
  /// In en, this message translates to:
  /// **'Connect Phantom wallet to trade'**
  String get connectPhantomToTrade;

  /// No description provided for @connect.
  ///
  /// In en, this message translates to:
  /// **'Connect'**
  String get connect;

  /// No description provided for @noPositions.
  ///
  /// In en, this message translates to:
  /// **'No positions yet'**
  String get noPositions;

  /// No description provided for @claimed.
  ///
  /// In en, this message translates to:
  /// **'Claimed'**
  String get claimed;

  /// No description provided for @missingPoolId.
  ///
  /// In en, this message translates to:
  /// **'Cannot link pool ID (on-chain market_id missing)'**
  String get missingPoolId;

  /// No description provided for @claimPayout.
  ///
  /// In en, this message translates to:
  /// **'Claim payout'**
  String get claimPayout;

  /// No description provided for @noLpShares.
  ///
  /// In en, this message translates to:
  /// **'No LP shares yet'**
  String get noLpShares;

  /// No description provided for @lpShares.
  ///
  /// In en, this message translates to:
  /// **'Shares {amount}'**
  String lpShares(String amount);

  /// No description provided for @redeemLp.
  ///
  /// In en, this message translates to:
  /// **'Redeem LP'**
  String get redeemLp;

  /// No description provided for @phantomWallet.
  ///
  /// In en, this message translates to:
  /// **'Phantom Wallet'**
  String get phantomWallet;

  /// No description provided for @notConnectedTestnet.
  ///
  /// In en, this message translates to:
  /// **'Not connected · Testnet'**
  String get notConnectedTestnet;

  /// No description provided for @disconnect.
  ///
  /// In en, this message translates to:
  /// **'Disconnect'**
  String get disconnect;

  /// No description provided for @connectPhantom.
  ///
  /// In en, this message translates to:
  /// **'Connect Phantom'**
  String get connectPhantom;

  /// No description provided for @testnetUsdcHint.
  ///
  /// In en, this message translates to:
  /// **'Get testnet USDC from the Circle faucet or transfer to your wallet'**
  String get testnetUsdcHint;

  /// No description provided for @refreshBalanceAndAssets.
  ///
  /// In en, this message translates to:
  /// **'Refresh balance & assets'**
  String get refreshBalanceAndAssets;

  /// No description provided for @recentTx.
  ///
  /// In en, this message translates to:
  /// **'Recent: {message}'**
  String recentTx(String message);

  /// No description provided for @testnetYear.
  ///
  /// In en, this message translates to:
  /// **'Testnet · {year}'**
  String testnetYear(int year);

  /// No description provided for @crossMarginVarTitle.
  ///
  /// In en, this message translates to:
  /// **'Cross-Margin VaR (estimate)'**
  String get crossMarginVarTitle;

  /// No description provided for @crossMarginVarWithPositions.
  ///
  /// In en, this message translates to:
  /// **'Aggregated worst-case across {count} positions, 15 outcome slots'**
  String crossMarginVarWithPositions(int count);

  /// No description provided for @crossMarginVarDefault.
  ///
  /// In en, this message translates to:
  /// **'Aggregated worst-case across 15 outcome slots'**
  String get crossMarginVarDefault;

  /// No description provided for @marginVarSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Wallet portfolio estimate; on-chain liability applies after registration'**
  String get marginVarSubtitle;

  /// No description provided for @marketForOpenAccount.
  ///
  /// In en, this message translates to:
  /// **'Market (open account)'**
  String get marketForOpenAccount;

  /// No description provided for @openMarginAccount.
  ///
  /// In en, this message translates to:
  /// **'Open margin account'**
  String get openMarginAccount;

  /// No description provided for @marginAccountIdHint.
  ///
  /// In en, this message translates to:
  /// **'Tap an account card below to auto-fill'**
  String get marginAccountIdHint;

  /// No description provided for @positionSamePool.
  ///
  /// In en, this message translates to:
  /// **'Position (same pool)'**
  String get positionSamePool;

  /// No description provided for @registerPosition.
  ///
  /// In en, this message translates to:
  /// **'Register position'**
  String get registerPosition;

  /// No description provided for @unregisterPosition.
  ///
  /// In en, this message translates to:
  /// **'Unregister'**
  String get unregisterPosition;

  /// No description provided for @marginAccountSummary.
  ///
  /// In en, this message translates to:
  /// **'Positions {count} · Gross {gross} USDC · Worst {worst} USDC\n{id}'**
  String marginAccountSummary(int count, String gross, String worst, String id);

  /// No description provided for @tabTrade.
  ///
  /// In en, this message translates to:
  /// **'Trade'**
  String get tabTrade;

  /// No description provided for @tabAuction.
  ///
  /// In en, this message translates to:
  /// **'Auction'**
  String get tabAuction;

  /// No description provided for @gasStationEnabled.
  ///
  /// In en, this message translates to:
  /// **'Gas Station enabled: sponsor pays gas (USDC still from your wallet)'**
  String get gasStationEnabled;

  /// No description provided for @gasStationOffline.
  ///
  /// In en, this message translates to:
  /// **'Gas Station offline: gas deducted from wallet SUI'**
  String get gasStationOffline;

  /// No description provided for @outcome012.
  ///
  /// In en, this message translates to:
  /// **'Outcome 0/1/2'**
  String get outcome012;

  /// No description provided for @contractType.
  ///
  /// In en, this message translates to:
  /// **'Contract type'**
  String get contractType;

  /// No description provided for @stakeUsdc.
  ///
  /// In en, this message translates to:
  /// **'Stake (USDC)'**
  String get stakeUsdc;

  /// No description provided for @lowerBoundPermille.
  ///
  /// In en, this message translates to:
  /// **'Lower bound ‰'**
  String get lowerBoundPermille;

  /// No description provided for @upperBoundPermille.
  ///
  /// In en, this message translates to:
  /// **'Upper bound ‰'**
  String get upperBoundPermille;

  /// No description provided for @lowerBound.
  ///
  /// In en, this message translates to:
  /// **'Lower bound'**
  String get lowerBound;

  /// No description provided for @upperBound.
  ///
  /// In en, this message translates to:
  /// **'Upper bound'**
  String get upperBound;

  /// No description provided for @threshold.
  ///
  /// In en, this message translates to:
  /// **'Threshold'**
  String get threshold;

  /// No description provided for @strikeK.
  ///
  /// In en, this message translates to:
  /// **'Strike K'**
  String get strikeK;

  /// No description provided for @barrierB.
  ///
  /// In en, this message translates to:
  /// **'Barrier B'**
  String get barrierB;

  /// No description provided for @subscribeUsdc.
  ///
  /// In en, this message translates to:
  /// **'Subscribe USDC'**
  String get subscribeUsdc;

  /// No description provided for @lpSubscribe.
  ///
  /// In en, this message translates to:
  /// **'LP subscribe'**
  String get lpSubscribe;

  /// No description provided for @auctionNotSupported.
  ///
  /// In en, this message translates to:
  /// **'Opening Auction not supported for this market'**
  String get auctionNotSupported;

  /// No description provided for @bucketIndex.
  ///
  /// In en, this message translates to:
  /// **'Bucket index'**
  String get bucketIndex;

  /// No description provided for @bidUsdc.
  ///
  /// In en, this message translates to:
  /// **'Bid USDC'**
  String get bidUsdc;

  /// No description provided for @auctionBid.
  ///
  /// In en, this message translates to:
  /// **'Place auction bid'**
  String get auctionBid;

  /// No description provided for @finalizeAuction.
  ///
  /// In en, this message translates to:
  /// **'Finalize auction'**
  String get finalizeAuction;

  /// No description provided for @quoteBetaUnsupported.
  ///
  /// In en, this message translates to:
  /// **'Quote preview: Beta / exotic contracts not supported by Pricing Engine'**
  String get quoteBetaUnsupported;

  /// No description provided for @quoteUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Quote preview unavailable (Pricing Engine offline or not configured)'**
  String get quoteUnavailable;

  /// No description provided for @quoteTitle.
  ///
  /// In en, this message translates to:
  /// **'Quote preview (off-chain estimate)'**
  String get quoteTitle;

  /// No description provided for @quoteWinProb.
  ///
  /// In en, this message translates to:
  /// **'Win probability ~ {percent}%'**
  String quoteWinProb(String percent);

  /// No description provided for @quotePayout.
  ///
  /// In en, this message translates to:
  /// **'Payout if hit ~ {amount} USDC'**
  String quotePayout(String amount);

  /// No description provided for @quoteImpliedRoi.
  ///
  /// In en, this message translates to:
  /// **'Implied ROI {roi}%'**
  String quoteImpliedRoi(String roi);

  /// No description provided for @buyWithGasSponsor.
  ///
  /// In en, this message translates to:
  /// **'Sign with Phantom & buy (gas sponsored)'**
  String get buyWithGasSponsor;

  /// No description provided for @buyWithPhantom.
  ///
  /// In en, this message translates to:
  /// **'Sign with Phantom & buy'**
  String get buyWithPhantom;

  /// No description provided for @contractInterval.
  ///
  /// In en, this message translates to:
  /// **'Interval'**
  String get contractInterval;

  /// No description provided for @contractDigital.
  ///
  /// In en, this message translates to:
  /// **'Digital option'**
  String get contractDigital;

  /// No description provided for @contractLinearCall.
  ///
  /// In en, this message translates to:
  /// **'Linear Call'**
  String get contractLinearCall;

  /// No description provided for @contractLinearPut.
  ///
  /// In en, this message translates to:
  /// **'Linear Put'**
  String get contractLinearPut;

  /// No description provided for @tabPublish.
  ///
  /// In en, this message translates to:
  /// **'Publish'**
  String get tabPublish;

  /// No description provided for @tabLeaderboard.
  ///
  /// In en, this message translates to:
  /// **'Leaderboard'**
  String get tabLeaderboard;

  /// No description provided for @selectMarket.
  ///
  /// In en, this message translates to:
  /// **'Please select a market'**
  String get selectMarket;

  /// No description provided for @cannotSubmit.
  ///
  /// In en, this message translates to:
  /// **'Cannot submit'**
  String get cannotSubmit;

  /// No description provided for @fillAnalysis.
  ///
  /// In en, this message translates to:
  /// **'Please enter analysis content'**
  String get fillAnalysis;

  /// No description provided for @predictedValueMustBeInt.
  ///
  /// In en, this message translates to:
  /// **'Predicted value must be an integer'**
  String get predictedValueMustBeInt;

  /// No description provided for @committingProphecy.
  ///
  /// In en, this message translates to:
  /// **'Uploading to Indexer → on-chain Commit…'**
  String get committingProphecy;

  /// No description provided for @myStats.
  ///
  /// In en, this message translates to:
  /// **'My record: {wins}W {losses}L · Score {score} · Audited {audited}'**
  String myStats(int wins, int losses, String score, int audited);

  /// No description provided for @targetMarket.
  ///
  /// In en, this message translates to:
  /// **'Target market'**
  String get targetMarket;

  /// No description provided for @predictedValue.
  ///
  /// In en, this message translates to:
  /// **'Predicted value'**
  String get predictedValue;

  /// No description provided for @predictedValueHelper.
  ///
  /// In en, this message translates to:
  /// **'Same settlement unit as {kind} distribution'**
  String predictedValueHelper(String kind);

  /// No description provided for @exclusiveAnalysis.
  ///
  /// In en, this message translates to:
  /// **'Exclusive analysis (plaintext)'**
  String get exclusiveAnalysis;

  /// No description provided for @mobileP3Hint.
  ///
  /// In en, this message translates to:
  /// **'Mobile P3: public practice only (unlock_price=0). Paid Seal predictions use Web /prophet.'**
  String get mobileP3Hint;

  /// No description provided for @processing.
  ///
  /// In en, this message translates to:
  /// **'Processing…'**
  String get processing;

  /// No description provided for @commitPublicProphecy.
  ///
  /// In en, this message translates to:
  /// **'Indexer plaintext → Commit public prediction'**
  String get commitPublicProphecy;

  /// No description provided for @poolProphecies.
  ///
  /// In en, this message translates to:
  /// **'Predictions for this market'**
  String get poolProphecies;

  /// No description provided for @noProphecies.
  ///
  /// In en, this message translates to:
  /// **'No predictions yet'**
  String get noProphecies;

  /// No description provided for @selectProphecy.
  ///
  /// In en, this message translates to:
  /// **'Select prediction'**
  String get selectProphecy;

  /// No description provided for @prophecyStatus.
  ///
  /// In en, this message translates to:
  /// **'Status: {status}'**
  String prophecyStatus(String status);

  /// No description provided for @prophecyValue.
  ///
  /// In en, this message translates to:
  /// **'Predicted value: {value}'**
  String prophecyValue(String value);

  /// No description provided for @prophecyPublicReadable.
  ///
  /// In en, this message translates to:
  /// **'Publicly readable'**
  String get prophecyPublicReadable;

  /// No description provided for @prophecyPrivateWeb.
  ///
  /// In en, this message translates to:
  /// **'Private (unlock via Web / Seal)'**
  String get prophecyPrivateWeb;

  /// No description provided for @analysisContent.
  ///
  /// In en, this message translates to:
  /// **'Analysis content'**
  String get analysisContent;

  /// No description provided for @leaderboardEmpty.
  ///
  /// In en, this message translates to:
  /// **'Indexer offline or no leaderboard data'**
  String get leaderboardEmpty;

  /// No description provided for @leaderboardMe.
  ///
  /// In en, this message translates to:
  /// **'Me ({address}…)'**
  String leaderboardMe(String address);

  /// No description provided for @leaderboardRow.
  ///
  /// In en, this message translates to:
  /// **'{wins}W {losses}L · Score {score}{paid}'**
  String leaderboardRow(int wins, int losses, String score, String paid);

  /// No description provided for @paidUnlockEnabled.
  ///
  /// In en, this message translates to:
  /// **' · Paid unlock enabled'**
  String get paidUnlockEnabled;

  /// No description provided for @prophecyStatusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get prophecyStatusOpen;

  /// No description provided for @prophecyStatusWin.
  ///
  /// In en, this message translates to:
  /// **'Audited · Win'**
  String get prophecyStatusWin;

  /// No description provided for @prophecyStatusLoss.
  ///
  /// In en, this message translates to:
  /// **'Audited · Loss'**
  String get prophecyStatusLoss;

  /// No description provided for @prophecyStatusCheat.
  ///
  /// In en, this message translates to:
  /// **'Cheat'**
  String get prophecyStatusCheat;

  /// No description provided for @prophecyStatusUnknown.
  ///
  /// In en, this message translates to:
  /// **'Unknown ({status})'**
  String prophecyStatusUnknown(int status);

  /// No description provided for @paidUnlockHintNew.
  ///
  /// In en, this message translates to:
  /// **'New prophets must publish free predictions (unlock_price=0), complete ≥{minAudited} audits with Score ≥ {minScore} before paid unlock'**
  String paidUnlockHintNew(int minAudited, String minScore);

  /// No description provided for @paidUnlockHintCheat.
  ///
  /// In en, this message translates to:
  /// **'Cheat record found; paid unlock unavailable'**
  String get paidUnlockHintCheat;

  /// No description provided for @paidUnlockHintProgress.
  ///
  /// In en, this message translates to:
  /// **'Audited {audited}/{required}; keep publishing free predictions to build record'**
  String paidUnlockHintProgress(int audited, int required);

  /// No description provided for @paidUnlockHintScore.
  ///
  /// In en, this message translates to:
  /// **'Prophet Score {score}, need ≥ {minScore} for paid unlock'**
  String paidUnlockHintScore(String score, String minScore);

  /// No description provided for @paidUnlockHintEligible.
  ///
  /// In en, this message translates to:
  /// **'Eligible for paid unlock (unlock_price > 0). Use Web App for Seal encrypted predictions on Mobile'**
  String get paidUnlockHintEligible;

  /// No description provided for @eligibilityNoPoolId.
  ///
  /// In en, this message translates to:
  /// **'Pool ID not configured'**
  String get eligibilityNoPoolId;

  /// No description provided for @eligibilityMarketResolved.
  ///
  /// In en, this message translates to:
  /// **'Market settled; predictions closed'**
  String get eligibilityMarketResolved;

  /// No description provided for @eligibilityMarketPaused.
  ///
  /// In en, this message translates to:
  /// **'Market paused'**
  String get eligibilityMarketPaused;

  /// No description provided for @eligibilityExpired.
  ///
  /// In en, this message translates to:
  /// **'Past maturity; predictions closed'**
  String get eligibilityExpired;

  /// No description provided for @eligibilityTooClose.
  ///
  /// In en, this message translates to:
  /// **'Less than {minutes} min to maturity; predictions closed'**
  String eligibilityTooClose(int minutes);

  /// No description provided for @eligibilityCanCommit.
  ///
  /// In en, this message translates to:
  /// **'Public prediction allowed (unlock_price=0)'**
  String get eligibilityCanCommit;

  /// No description provided for @connectWalletFirst.
  ///
  /// In en, this message translates to:
  /// **'Please connect wallet first'**
  String get connectWalletFirst;

  /// No description provided for @gasSponsorFallback.
  ///
  /// In en, this message translates to:
  /// **'Gas sponsor unavailable, paying gas yourself: {error}'**
  String gasSponsorFallback(String error);

  /// No description provided for @unknownMarket.
  ///
  /// In en, this message translates to:
  /// **'Unknown market'**
  String get unknownMarket;

  /// No description provided for @walletSessionRestored.
  ///
  /// In en, this message translates to:
  /// **'Phantom session restored'**
  String get walletSessionRestored;

  /// No description provided for @openingPhantom.
  ///
  /// In en, this message translates to:
  /// **'Opening Phantom…'**
  String get openingPhantom;

  /// No description provided for @connectPhantomFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to connect Phantom: {error}'**
  String connectPhantomFailed(String error);

  /// No description provided for @connectPhantomWalletFirst.
  ///
  /// In en, this message translates to:
  /// **'Please connect Phantom wallet first'**
  String get connectPhantomWalletFirst;

  /// No description provided for @waitingPhantomConfirm.
  ///
  /// In en, this message translates to:
  /// **'Waiting for Phantom: {description}'**
  String waitingPhantomConfirm(String description);

  /// No description provided for @submitTxFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to submit transaction: {error}'**
  String submitTxFailed(String error);

  /// No description provided for @callbackFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to handle callback: {error}'**
  String callbackFailed(String error);

  /// No description provided for @walletDisconnected.
  ///
  /// In en, this message translates to:
  /// **'Wallet disconnected'**
  String get walletDisconnected;

  /// No description provided for @phantomConnected.
  ///
  /// In en, this message translates to:
  /// **'Phantom connected: {address}'**
  String phantomConnected(String address);

  /// No description provided for @txSuccess.
  ///
  /// In en, this message translates to:
  /// **'Transaction success: {digest}'**
  String txSuccess(String digest);

  /// No description provided for @phantomBroadcastNoDigest.
  ///
  /// In en, this message translates to:
  /// **'Phantom broadcast (no digest returned)'**
  String get phantomBroadcastNoDigest;

  /// No description provided for @missingPendingTx.
  ///
  /// In en, this message translates to:
  /// **'Missing pending transaction'**
  String get missingPendingTx;

  /// No description provided for @cannotOpenPhantom.
  ///
  /// In en, this message translates to:
  /// **'Cannot open Phantom; confirm the wallet app is installed'**
  String get cannotOpenPhantom;

  /// No description provided for @txClaimPosition.
  ///
  /// In en, this message translates to:
  /// **'Claim position'**
  String get txClaimPosition;

  /// No description provided for @txLpDeposit.
  ///
  /// In en, this message translates to:
  /// **'LP deposit'**
  String get txLpDeposit;

  /// No description provided for @txLpWithdraw.
  ///
  /// In en, this message translates to:
  /// **'LP withdraw'**
  String get txLpWithdraw;

  /// No description provided for @txAuctionBid.
  ///
  /// In en, this message translates to:
  /// **'Auction bid'**
  String get txAuctionBid;

  /// No description provided for @txFinalizeAuction.
  ///
  /// In en, this message translates to:
  /// **'Finalize auction'**
  String get txFinalizeAuction;

  /// No description provided for @txOpenMarginAccount.
  ///
  /// In en, this message translates to:
  /// **'Open margin account'**
  String get txOpenMarginAccount;

  /// No description provided for @txRegisterPosition.
  ///
  /// In en, this message translates to:
  /// **'Register position'**
  String get txRegisterPosition;

  /// No description provided for @txUnregisterPosition.
  ///
  /// In en, this message translates to:
  /// **'Unregister position'**
  String get txUnregisterPosition;

  /// No description provided for @txCommitProphecy.
  ///
  /// In en, this message translates to:
  /// **'Commit public prediction'**
  String get txCommitProphecy;

  /// No description provided for @errInvalidAmount.
  ///
  /// In en, this message translates to:
  /// **'Invalid amount'**
  String get errInvalidAmount;

  /// No description provided for @errMaxDecimals.
  ///
  /// In en, this message translates to:
  /// **'At most {decimals} decimal places'**
  String errMaxDecimals(int decimals);

  /// No description provided for @errAmountMustBePositive.
  ///
  /// In en, this message translates to:
  /// **'Amount must be greater than 0'**
  String get errAmountMustBePositive;

  /// No description provided for @errNoUsdcInWallet.
  ///
  /// In en, this message translates to:
  /// **'No USDC in wallet — transfer or claim testnet USDC first'**
  String get errNoUsdcInWallet;

  /// No description provided for @errInsufficientUsdc.
  ///
  /// In en, this message translates to:
  /// **'Insufficient USDC: need {need}, have {have}'**
  String errInsufficientUsdc(String need, String have);

  /// No description provided for @errStructuredNoteCap.
  ///
  /// In en, this message translates to:
  /// **'Structured Note requires C > K'**
  String get errStructuredNoteCap;

  /// No description provided for @errRangeNoteBounds.
  ///
  /// In en, this message translates to:
  /// **'Range Note requires U >= L'**
  String get errRangeNoteBounds;

  /// No description provided for @errUnsupportedMarketKind.
  ///
  /// In en, this message translates to:
  /// **'Unsupported market type: {kind}'**
  String errUnsupportedMarketKind(String kind);

  /// No description provided for @errNoDigest.
  ///
  /// In en, this message translates to:
  /// **'Transaction succeeded but no digest returned'**
  String get errNoDigest;

  /// No description provided for @errProphetRegistryNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'ProphetRegistry not configured'**
  String get errProphetRegistryNotConfigured;

  /// No description provided for @errIndexerNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'Indexer is not configured'**
  String get errIndexerNotConfigured;

  /// No description provided for @errEmptyPoolId.
  ///
  /// In en, this message translates to:
  /// **'pool_id is empty'**
  String get errEmptyPoolId;

  /// No description provided for @errEmptyBlob.
  ///
  /// In en, this message translates to:
  /// **'Empty blob'**
  String get errEmptyBlob;

  /// No description provided for @errBlobTooLarge.
  ///
  /// In en, this message translates to:
  /// **'Blob exceeds 512KB limit'**
  String get errBlobTooLarge;

  /// No description provided for @errIndexerUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Indexer upload failed ({status}): {body}'**
  String errIndexerUploadFailed(int status, String body);

  /// No description provided for @errInvalidIndexerResponse.
  ///
  /// In en, this message translates to:
  /// **'Invalid Indexer response'**
  String get errInvalidIndexerResponse;

  /// No description provided for @errMissingBlobId.
  ///
  /// In en, this message translates to:
  /// **'Indexer response missing blob_id'**
  String get errMissingBlobId;

  /// No description provided for @errIndexerBlobReadFailed.
  ///
  /// In en, this message translates to:
  /// **'Indexer blob read failed ({status})'**
  String errIndexerBlobReadFailed(int status);

  /// No description provided for @errIpfsReadFailed.
  ///
  /// In en, this message translates to:
  /// **'IPFS read failed ({status})'**
  String errIpfsReadFailed(int status);

  /// No description provided for @errUnsupportedBlobId.
  ///
  /// In en, this message translates to:
  /// **'Unsupported blob_id (need idx: or ipfs:)'**
  String get errUnsupportedBlobId;

  /// No description provided for @errGasStationNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'Gas Station is not configured'**
  String get errGasStationNotConfigured;

  /// No description provided for @errGasStationHttpError.
  ///
  /// In en, this message translates to:
  /// **'Gas Station error: {error}'**
  String errGasStationHttpError(String error);

  /// No description provided for @errGasStationInvalidResponse.
  ///
  /// In en, this message translates to:
  /// **'Invalid Gas Station response'**
  String get errGasStationInvalidResponse;

  /// No description provided for @errInvalidAddress.
  ///
  /// In en, this message translates to:
  /// **'Invalid address (expected 0x hex)'**
  String get errInvalidAddress;

  /// No description provided for @errRpcHttpFailed.
  ///
  /// In en, this message translates to:
  /// **'RPC request failed: HTTP {status}'**
  String errRpcHttpFailed(int status);

  /// No description provided for @errRpcError.
  ///
  /// In en, this message translates to:
  /// **'RPC error: {error}'**
  String errRpcError(String error);

  /// No description provided for @errRpcInvalidResponse.
  ///
  /// In en, this message translates to:
  /// **'Invalid RPC response'**
  String get errRpcInvalidResponse;

  /// No description provided for @errRpcMissingField.
  ///
  /// In en, this message translates to:
  /// **'Missing RPC field: {field}'**
  String errRpcMissingField(String field);

  /// No description provided for @errCallbackMissingSigOrTx.
  ///
  /// In en, this message translates to:
  /// **'Callback missing signature or transaction'**
  String get errCallbackMissingSigOrTx;

  /// No description provided for @seedPoissonGoalsTitle.
  ///
  /// In en, this message translates to:
  /// **'Total goals · Poisson'**
  String get seedPoissonGoalsTitle;

  /// No description provided for @seedDirichletWdlTitle.
  ///
  /// In en, this message translates to:
  /// **'Win / Draw / Loss · Dirichlet'**
  String get seedDirichletWdlTitle;

  /// No description provided for @seedNormalCpiTitle.
  ///
  /// In en, this message translates to:
  /// **'CPI range · Normal'**
  String get seedNormalCpiTitle;

  /// No description provided for @seedBetaVoteTitle.
  ///
  /// In en, this message translates to:
  /// **'Vote share · Beta'**
  String get seedBetaVoteTitle;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
