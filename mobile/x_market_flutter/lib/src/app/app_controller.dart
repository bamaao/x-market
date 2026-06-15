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

import 'package:flutter/widgets.dart';
import 'package:x_market_flutter/src/l10n/l10n_ext.dart';
import 'package:x_market_flutter/src/l10n/app_exception.dart';
import 'package:x_market_flutter/src/l10n/l10n_helpers.dart';
import 'package:x_market_flutter/src/models/indexer_models.dart';
import 'package:x_market_flutter/src/models/owned_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/services/gas_station_service.dart';
import 'package:x_market_flutter/src/services/indexer_service.dart';
import 'package:x_market_flutter/src/services/market_catalog.dart';
import 'package:x_market_flutter/src/services/owned_objects_service.dart';
import 'package:x_market_flutter/src/services/pricing_service.dart';
import 'package:x_market_flutter/src/services/prophet_service.dart';
import 'package:x_market_flutter/src/services/sui_rpc_service.dart';
import 'package:x_market_flutter/src/risk/cross_margin_var.dart';
import 'package:x_market_flutter/src/trade/buy_transaction_service.dart';
import 'package:x_market_flutter/src/utils/move_object_fields.dart';
import 'package:x_market_flutter/src/wallet/phantom_wallet_controller.dart';

class AppController extends ChangeNotifier {
  AppController({
    PhantomWalletController? wallet,
    SuiRpcService? rpc,
    ChainTransactionService? tx,
    OwnedObjectsService? owned,
    IndexerService? indexer,
    GasStationService? gasStation,
    PricingService? pricing,
    ProphetService? prophet,
    Locale? initialLocale,
  }) : wallet = wallet ?? PhantomWalletController(),
       rpc = rpc ?? SuiRpcService(),
       tx = tx ?? ChainTransactionService(),
       owned = owned ?? OwnedObjectsService(),
       indexer = indexer ?? IndexerService(),
       gasStation = gasStation ?? GasStationService(),
       pricing = pricing ?? PricingService(),
       prophet = prophet ?? ProphetService(),
       locale = resolveAppLocale(
         initialLocale ?? WidgetsBinding.instance.platformDispatcher.locale,
       ) {
    this.wallet.l10nProvider = () => l10n;
  }

  final PhantomWalletController wallet;
  final SuiRpcService rpc;
  final ChainTransactionService tx;
  final OwnedObjectsService owned;
  final IndexerService indexer;
  final GasStationService gasStation;
  final PricingService pricing;
  final ProphetService prophet;

  Locale locale;

  AppLocalizations get l10n => lookupAppLocalizations(locale);

  void setLocale(Locale value) {
    final next = resolveAppLocale(value);
    if (next == locale) return;
    locale = next;
    notifyListeners();
  }

  List<MarketPoolSnapshot> markets = const [];
  Map<String, MarketRef> marketRefsByPoolId = const {};
  bool marketSourceIsIndexer = false;
  bool indexerReachable = false;
  bool gasStationReachable = false;

  WalletSummary? walletSummary;
  List<PositionSnapshot> positions = const [];
  List<LpShareSnapshot> lpShares = const [];
  List<MarginAccountSnapshot> marginAccounts = const [];

  bool loadingMarkets = false;
  bool loadingWallet = false;
  String? lastTxMessage;

  bool get indexerEnabled => IndexerService.enabled;
  bool get gasStationEnabled => GasStationService.enabled;
  bool get pricingEnabled => PricingService.enabled;

  Future<void> bootstrap() async {
    wallet.addListener(notifyListeners);
    await wallet.initialize();
    await refreshMarkets();
    if (gasStationEnabled) {
      gasStationReachable = await gasStation.checkHealth();
    }
    if (wallet.isConnected) {
      await refreshWalletData();
    }
  }

  @override
  void dispose() {
    wallet.removeListener(notifyListeners);
    wallet.dispose();
    super.dispose();
  }

  Future<void> refreshMarkets() async {
    loadingMarkets = true;
    notifyListeners();
    try {
      final seeds = await rpc.fetchSeedMarkets();
      if (indexerEnabled) {
        indexerReachable = await indexer.checkHealth();
        final rows =
            indexerReachable ? await indexer.fetchMarkets() : <IndexerMarket>[];
        final merged = await MarketCatalog.merge(
          seeds: seeds,
          indexerRows: rows,
          rpc: rpc,
        );
        markets = merged.markets;
        marketRefsByPoolId = merged.refsByPoolId;
        marketSourceIsIndexer = merged.usedIndexer;
      } else {
        indexerReachable = false;
        marketSourceIsIndexer = false;
        markets = seeds;
        marketRefsByPoolId = {
          for (final s in seeds) s.poolId: MarketCatalog.seedToRef(s),
        };
      }
    } finally {
      loadingMarkets = false;
      notifyListeners();
    }
  }

  Future<void> refreshWalletData() async {
    final address = wallet.address;
    if (address == null) {
      return;
    }
    loadingWallet = true;
    notifyListeners();
    try {
      walletSummary = await rpc.fetchWalletSummary(address: address);
      positions = await owned.fetchPositions(address);
      lpShares = await owned.fetchLpShares(address);
      marginAccounts = await owned.fetchMarginAccounts(address);
      await _ensureMarketRefsForPositions();
    } finally {
      loadingWallet = false;
      notifyListeners();
    }
  }

  Future<void> _ensureMarketRefsForPositions() async {
    if (!indexerEnabled) return;
    var updated = false;
    for (final position in positions) {
      final poolId = position.poolId;
      if (poolId == null || poolId.isEmpty) continue;
      if (MarketCatalog.findRefByPoolId(poolId, marketRefsByPoolId) != null) {
        continue;
      }
      final row = await indexer.fetchMarket(poolId);
      if (row == null) continue;
      marketRefsByPoolId = {
        ...marketRefsByPoolId,
        row.poolId: MarketCatalog.indexerToRef(row),
      };
      updated = true;
    }
    if (updated) {
      notifyListeners();
    }
  }

  Future<void> connectWallet() async {
    await wallet.connectPhantom();
  }

  Future<void> disconnectWallet() async {
    await wallet.disconnect();
    walletSummary = null;
    positions = const [];
    lpShares = const [];
    marginAccounts = const [];
    notifyListeners();
  }

  Future<void> submitChainTx(
    Future<PendingBuyTransaction> Function(String sender) build, {
    PhantomSubmitMode mode = PhantomSubmitMode.signAndSend,
    bool preferGasStation = true,
  }) async {
    final address = wallet.address;
    if (address == null) {
      wallet.errorMessage = l10n.connectWalletFirst;
      notifyListeners();
      return;
    }
    try {
      var pending = await build(address);
      var submitMode = mode;

      if (preferGasStation &&
          gasStationEnabled &&
          gasStationReachable &&
          pending.transactionKindBase64 != null) {
        try {
          final sponsor = await gasStation.requestSponsor(
            transactionKindBase64: pending.transactionKindBase64!,
            sender: address,
          );
          pending = pending.withSponsor(sponsor);
          submitMode = PhantomSubmitMode.signOnly;
        } catch (e) {
          lastTxMessage = l10n.gasSponsorFallback(localizeError(l10n, e));
        }
      }

      await wallet.submitTransaction(
        pending,
        sender: address,
        mode: submitMode,
        onSuccess: (_) async {
          lastTxMessage = localizeTxDescription(l10n, pending.description);
          await refreshWalletData();
          notifyListeners();
        },
      );
    } catch (e) {
      wallet.errorMessage = localizeError(l10n, e);
      notifyListeners();
    }
  }

  static String formatUsdc(int mist) {
    final major = mist ~/ 1000000;
    final minor = (mist % 1000000).toString().padLeft(6, '0');
    final trimmed = minor.replaceFirst(RegExp(r'0+$'), '');
    return trimmed.isEmpty ? '$major' : '$major.$trimmed';
  }

  MarketRef? marketRefFor(String? poolId) {
    return MarketCatalog.findRefByPoolId(poolId, marketRefsByPoolId);
  }

  String poolLabelFor(String? poolId) {
    final ref = marketRefFor(poolId);
    if (ref != null && ref.title.isNotEmpty) {
      return ref.title;
    }
    if (poolId == null || poolId.isEmpty) {
      return l10n.unknownMarket;
    }
    for (final market in markets) {
      if (poolIdsMatch(market.poolId, poolId)) {
        return displayMarketLabel(l10n, market);
      }
    }
    return '${poolId.substring(0, poolId.length.clamp(0, 10))}…';
  }

  List<PositionSnapshot> positionsForPool(String? poolId) {
    if (poolId == null || poolId.isEmpty) {
      return const [];
    }
    return positions
        .where((p) => poolIdsMatch(p.poolId, poolId) && !p.claimed)
        .toList();
  }

  /// Front-end VaR across all wallet positions (same as Web `/positions`).
  int get crossMarginVarMist => estimateCrossMarginVar(positions);

  int crossMarginVarForPool(String? poolId) {
    if (poolId == null || poolId.isEmpty) {
      return 0;
    }
    return estimateCrossMarginVar(
      positions.where((p) => poolIdsMatch(p.poolId, poolId)).toList(),
    );
  }
}
