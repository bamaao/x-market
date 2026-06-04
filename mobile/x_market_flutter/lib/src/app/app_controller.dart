import 'package:flutter/foundation.dart';
import 'package:x_market_flutter/src/models/owned_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/services/owned_objects_service.dart';
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
  }) : wallet = wallet ?? PhantomWalletController(),
       rpc = rpc ?? SuiRpcService(),
       tx = tx ?? ChainTransactionService(),
       owned = owned ?? OwnedObjectsService();

  final PhantomWalletController wallet;
  final SuiRpcService rpc;
  final ChainTransactionService tx;
  final OwnedObjectsService owned;

  List<MarketPoolSnapshot> markets = const [];
  WalletSummary? walletSummary;
  List<PositionSnapshot> positions = const [];
  List<LpShareSnapshot> lpShares = const [];
  List<MarginAccountSnapshot> marginAccounts = const [];

  bool loadingMarkets = false;
  bool loadingWallet = false;
  String? lastTxMessage;

  Future<void> bootstrap() async {
    wallet.addListener(notifyListeners);
    await wallet.initialize();
    await refreshMarkets();
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
      markets = await rpc.fetchSeedMarkets();
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
    } finally {
      loadingWallet = false;
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
  }) async {
    final address = wallet.address;
    if (address == null) {
      wallet.errorMessage = '请先连接钱包';
      notifyListeners();
      return;
    }
    try {
      final pending = await build(address);
      await wallet.submitTransaction(
        pending,
        mode: mode,
        onSuccess: (_) async {
          lastTxMessage = pending.description;
          await refreshWalletData();
          notifyListeners();
        },
      );
    } catch (e) {
      wallet.errorMessage = '$e';
      notifyListeners();
    }
  }

  static String formatUsdc(int mist) {
    final major = mist ~/ 1000000;
    final minor = (mist % 1000000).toString().padLeft(6, '0');
    final trimmed = minor.replaceFirst(RegExp(r'0+$'), '');
    return trimmed.isEmpty ? '$major' : '$major.$trimmed';
  }

  String poolLabelFor(String? poolId) {
    if (poolId == null || poolId.isEmpty) {
      return '未知市场';
    }
    for (final market in markets) {
      if (poolIdsMatch(market.poolId, poolId)) {
        return market.label;
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
