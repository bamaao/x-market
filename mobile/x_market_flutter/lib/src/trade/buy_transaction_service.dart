import 'dart:convert';

import 'package:sui/builder/transaction.dart';
import 'package:sui/sui_client.dart';
import 'package:sui/types/framework.dart';
import 'package:sui/types/transactions.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class PendingBuyTransaction {
  const PendingBuyTransaction({
    required this.txJson,
    required this.txBytesBase64,
    required this.description,
  });

  final String txJson;
  final String txBytesBase64;
  final String description;
}

enum ContractMode {
  interval,
  digital,
  linearCall,
  linearPut,
  straddle,
  varianceSwap,
  structuredNote,
  rangeNote,
  barrierNote,
}

extension ContractModeLabel on ContractMode {
  String get label => switch (this) {
    ContractMode.interval => '区间合约',
    ContractMode.digital => '数字期权',
    ContractMode.linearCall => '线性 Call',
    ContractMode.linearPut => '线性 Put',
    ContractMode.straddle => 'Straddle',
    ContractMode.varianceSwap => 'Variance Swap',
    ContractMode.structuredNote => 'Structured Note',
    ContractMode.rangeNote => 'Range Note',
    ContractMode.barrierNote => 'Barrier Note',
  };

  String get moveTargetSuffix => switch (this) {
    ContractMode.interval => 'interval',
    ContractMode.digital => 'digital',
    ContractMode.linearCall => 'linear_call',
    ContractMode.linearPut => 'linear_put',
    ContractMode.straddle => 'straddle',
    ContractMode.varianceSwap => 'variance_swap',
    ContractMode.structuredNote => 'structured_note',
    ContractMode.rangeNote => 'range_note',
    ContractMode.barrierNote => 'barrier_note',
  };
}

class BuyParams {
  const BuyParams({
    required this.poolId,
    required this.marketKind,
    required this.mode,
    this.poissonA = 2,
    this.poissonB = 3,
    this.poissonK = 2,
    this.dirichletOutcome = 0,
    this.normalA = 25,
    this.normalB = 27,
    this.normalThreshold = 30,
    this.normalStrike = 25,
    this.normalCap = 30,
    this.normalLower = 24,
    this.normalUpper = 28,
    this.normalBarrier = 26,
    this.betaA = 350,
    this.betaB = 400,
  });

  final String poolId;
  final String marketKind;
  final ContractMode mode;
  final int poissonA;
  final int poissonB;
  final int poissonK;
  final int dirichletOutcome;
  final int normalA;
  final int normalB;
  final int normalThreshold;
  final int normalStrike;
  final int normalCap;
  final int normalLower;
  final int normalUpper;
  final int normalBarrier;
  final int betaA;
  final int betaB;

  void validate() {
    if (marketKind == 'normal' && mode == ContractMode.structuredNote) {
      if (normalCap <= normalStrike) {
        throw Exception('Structured Note 需要 C > K');
      }
    }
    if (marketKind == 'normal' && mode == ContractMode.rangeNote) {
      if (normalUpper < normalLower) {
        throw Exception('Range Note 需要 U >= L');
      }
    }
  }
}

class ChainTransactionService {
  ChainTransactionService({String? rpcUrl})
    : _client = SuiClient(rpcUrl ?? SuiConfig.rpcUrl);

  final SuiClient _client;

  /// 兼容旧名。
  static ChainTransactionService buy() => ChainTransactionService();

  static const int usdcDecimals = 6;

  static List<ContractMode> modesForMarketKind(String kind) {
    switch (kind) {
      case 'poisson':
        return const [ContractMode.interval, ContractMode.digital];
      case 'dirichlet':
        return const [];
      case 'beta':
        return const [];
      case 'normal':
        return ContractMode.values;
      default:
        return const [];
    }
  }

  int parseUsdcAmount(String input) {
    final trimmed = input.trim();
    if (!RegExp(r'^\d+(\.\d+)?$').hasMatch(trimmed)) {
      throw Exception('无效金额');
    }
    final parts = trimmed.split('.');
    final whole = parts[0];
    final frac = parts.length > 1 ? parts[1] : '';
    if (frac.length > usdcDecimals) {
      throw Exception('最多 $usdcDecimals 位小数');
    }
    final padded = frac.padRight(usdcDecimals, '0');
    return int.parse('$whole$padded');
  }

  Future<List<({String id, BigInt balance})>> listUsdcCoins(String owner) async {
    final coins = <({String id, BigInt balance})>[];
    String? cursor;
    do {
      final page = await _client.getCoins(
        owner,
        coinType: SuiConfig.usdcCoinType,
        cursor: cursor,
      );
      for (final coin in page.data) {
        coins.add((
          id: coin.coinObjectId,
          balance: BigInt.parse(coin.balance),
        ));
      }
      cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor != null);
    return coins;
  }

  Future<PendingBuyTransaction> buildBuy({
    required String sender,
    required BuyParams params,
    required int stakeUsdcMist,
  }) async {
    params.validate();
    if (stakeUsdcMist <= 0) {
      throw Exception('金额须大于 0');
    }

    final coins = await listUsdcCoins(sender);
    if (coins.isEmpty) {
      throw Exception('钱包中没有 USDC，请先在 Testnet 铸造');
    }

    final total = coins.fold<BigInt>(
      BigInt.zero,
      (sum, coin) => sum + coin.balance,
    );
    final stake = BigInt.from(stakeUsdcMist);
    if (total < stake) {
      throw Exception(
        'USDC 不足：需要 $stakeUsdcMist mist，持有 ${total.toInt()} mist',
      );
    }

    final sorted = [...coins]
      ..sort((a, b) => b.balance.compareTo(a.balance));
    final primary = sorted.first.id;
    final mergeSources = sorted.skip(1).map((coin) => coin.id).toList();

    final tx = Transaction();
    tx.setSender(sender);

    if (mergeSources.isNotEmpty) {
      tx.mergeCoins(
        tx.object(primary),
        mergeSources.map(tx.object).toList(),
      );
    }

    final payment = tx.splitCoins(tx.object(primary), [stake]);
    _appendBuyMoveCall(tx, payment, params);

    final bytes = await tx.build(BuildOptions(client: _client));
    return PendingBuyTransaction(
      txJson: tx.toJson(),
      txBytesBase64: base64Encode(bytes),
      description: _describeBuy(params, stakeUsdcMist),
    );
  }

  void _appendBuyMoveCall(
    Transaction tx,
    TransactionResult payment,
    BuyParams params,
  ) {
    final pkg = SuiConfig.packageId;
    final pool = tx.object(params.poolId);
    final clock = tx.object(SUI_CLOCK_OBJECT_ID);

    switch (params.marketKind) {
      case 'poisson':
        if (params.mode == ContractMode.digital) {
          tx.moveCall(
            '$pkg::pool::buy_poisson_digital',
            arguments: [pool, payment, tx.pure.u8(params.poissonK), clock],
          );
        } else {
          tx.moveCall(
            '$pkg::pool::buy_poisson_interval',
            arguments: [
              pool,
              payment,
              tx.pure.u8(params.poissonA),
              tx.pure.u8(params.poissonB),
              clock,
            ],
          );
        }
      case 'dirichlet':
        tx.moveCall(
          '$pkg::pool::buy_dirichlet_outcome',
          arguments: [
            pool,
            payment,
            tx.pure.u8(params.dirichletOutcome),
            clock,
          ],
        );
      case 'beta':
        tx.moveCall(
          '$pkg::pool::buy_beta_interval',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.betaA)),
            tx.pure.u64(BigInt.from(params.betaB)),
            clock,
          ],
        );
      case 'normal':
        _appendNormalBuyMoveCall(tx, pool, payment, clock, params);
      default:
        throw Exception('不支持的市场类型: ${params.marketKind}');
    }
  }

  void _appendNormalBuyMoveCall(
    Transaction tx,
    Map<String, dynamic> pool,
    TransactionResult payment,
    Map<String, dynamic> clock,
    BuyParams params,
  ) {
    final pkg = SuiConfig.packageId;
    switch (params.mode) {
      case ContractMode.digital:
        tx.moveCall(
          '$pkg::pool::buy_normal_digital',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalThreshold)),
            clock,
          ],
        );
      case ContractMode.linearCall:
        tx.moveCall(
          '$pkg::pool::buy_normal_linear_call',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalStrike)),
            clock,
          ],
        );
      case ContractMode.linearPut:
        tx.moveCall(
          '$pkg::pool::buy_normal_linear_put',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalStrike)),
            clock,
          ],
        );
      case ContractMode.straddle:
        tx.moveCall(
          '$pkg::pool::buy_normal_straddle',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalStrike)),
            clock,
          ],
        );
      case ContractMode.varianceSwap:
        tx.moveCall(
          '$pkg::pool::buy_normal_variance_swap',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalStrike)),
            clock,
          ],
        );
      case ContractMode.structuredNote:
        tx.moveCall(
          '$pkg::pool::buy_normal_structured_note',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalStrike)),
            tx.pure.u64(BigInt.from(params.normalCap)),
            clock,
          ],
        );
      case ContractMode.rangeNote:
        tx.moveCall(
          '$pkg::pool::buy_normal_range_note',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalLower)),
            tx.pure.u64(BigInt.from(params.normalUpper)),
            clock,
          ],
        );
      case ContractMode.barrierNote:
        tx.moveCall(
          '$pkg::pool::buy_normal_barrier_note',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalBarrier)),
            clock,
          ],
        );
      case ContractMode.interval:
        tx.moveCall(
          '$pkg::pool::buy_normal_interval',
          arguments: [
            pool,
            payment,
            tx.pure.u64(BigInt.from(params.normalA)),
            tx.pure.u64(BigInt.from(params.normalB)),
            clock,
          ],
        );
    }
  }

  String _describeBuy(BuyParams params, int stakeUsdcMist) {
    final stake = stakeUsdcMist / 1000000;
    switch (params.marketKind) {
      case 'poisson':
        if (params.mode == ContractMode.digital) {
          return 'Poisson digital k=${params.poissonK} stake=$stake USDC';
        }
        return 'Poisson interval [${params.poissonA},${params.poissonB}] stake=$stake USDC';
      case 'dirichlet':
        return 'Dirichlet outcome=${params.dirichletOutcome} stake=$stake USDC';
      case 'beta':
        return 'Beta interval [${params.betaA},${params.betaB}] ‰ stake=$stake USDC';
      case 'normal':
        return 'Normal ${params.mode.label} stake=$stake USDC';
      default:
        return 'Buy stake=$stake USDC';
    }
  }

  Future<String> executeSignedBlock({required String txBytesBase64}) async {
    final result = await _client.executeTransactionBlock(
      txBytesBase64,
      const [],
      options: SuiTransactionBlockResponseOptions(showEffects: true),
    );
    if (result.digest.isEmpty) {
      throw Exception('执行成功但未返回 digest');
    }
    return result.digest;
  }

  Future<String> executeWithSignature({
    required String txBytesBase64,
    required String signature,
  }) async {
    final result = await _client.executeTransactionBlock(
      txBytesBase64,
      [signature],
      options: SuiTransactionBlockResponseOptions(showEffects: true),
    );
    if (result.digest.isEmpty) {
      throw Exception('执行成功但未返回 digest');
    }
    return result.digest;
  }

  Future<PendingBuyTransaction> buildClaimPosition({
    required String sender,
    required String poolId,
    required String positionId,
  }) {
    return _buildSimple(
      sender: sender,
      description: '领取 Position',
      build: (tx) {
        tx.moveCall(
          '${SuiConfig.packageId}::settlement::claim_position',
          arguments: [tx.object(poolId), tx.object(positionId)],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildDepositLiquidity({
    required String sender,
    required String poolId,
    required int amountUsdcMist,
  }) {
    return _buildWithUsdcPayment(
      sender: sender,
      amountMist: amountUsdcMist,
      description: 'LP 申购',
      build: (tx, payment) {
        tx.moveCall(
          '${SuiConfig.packageId}::pool::deposit_liquidity',
          arguments: [
            tx.object(poolId),
            payment,
            tx.object(SuiConfig.suiClockId),
          ],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildWithdrawLiquidity({
    required String sender,
    required String poolId,
    required String lpShareId,
  }) {
    return _buildSimple(
      sender: sender,
      description: 'LP 赎回',
      build: (tx) {
        tx.moveCall(
          '${SuiConfig.packageId}::pool::withdraw_liquidity',
          arguments: [
            tx.object(poolId),
            tx.object(lpShareId),
            tx.object(SuiConfig.suiClockId),
          ],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildAuctionBid({
    required String sender,
    required String poolId,
    required int amountUsdcMist,
    required int bucketIndex,
  }) {
    return _buildWithUsdcPayment(
      sender: sender,
      amountMist: amountUsdcMist,
      description: '拍卖出价',
      build: (tx, payment) {
        tx.moveCall(
          '${SuiConfig.packageId}::pool::auction_bid',
          arguments: [
            tx.object(poolId),
            payment,
            tx.pure.u8(bucketIndex),
            tx.object(SuiConfig.suiClockId),
          ],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildFinalizeAuction({
    required String sender,
    required String poolId,
    required String marketKind,
  }) {
    final target = switch (marketKind) {
      'dirichlet' => '${SuiConfig.packageId}::pool::finalize_dirichlet_auction',
      'normal' => '${SuiConfig.packageId}::pool::finalize_normal_auction',
      _ => '${SuiConfig.packageId}::pool::finalize_poisson_auction',
    };
    return _buildSimple(
      sender: sender,
      description: '拍卖定标',
      build: (tx) {
        tx.moveCall(
          target,
          arguments: [tx.object(poolId), tx.object(SuiConfig.suiClockId)],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildOpenMarginAccount({
    required String sender,
    required String poolId,
  }) {
    return _buildSimple(
      sender: sender,
      description: '开设保证金账户',
      build: (tx) {
        tx.moveCall(
          '${SuiConfig.packageId}::cross_margin::open_account',
          arguments: [tx.object(poolId)],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildRegisterPosition({
    required String sender,
    required String marginAccountId,
    required String poolId,
    required String positionId,
  }) {
    return _buildSimple(
      sender: sender,
      description: '登记持仓',
      build: (tx) {
        tx.moveCall(
          '${SuiConfig.packageId}::cross_margin::register_position',
          arguments: [
            tx.object(marginAccountId),
            tx.object(poolId),
            tx.object(positionId),
          ],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildUnregisterPosition({
    required String sender,
    required String marginAccountId,
    required String poolId,
    required String positionId,
  }) {
    return _buildSimple(
      sender: sender,
      description: '取消登记',
      build: (tx) {
        tx.moveCall(
          '${SuiConfig.packageId}::cross_margin::unregister_position',
          arguments: [
            tx.object(marginAccountId),
            tx.object(poolId),
            tx.object(positionId),
          ],
        );
      },
    );
  }

  Future<PendingBuyTransaction> buildMintTestUsdc({required String sender}) {
    return _buildSimple(
      sender: sender,
      description: '铸造测试 USDC',
      build: (tx) {
        tx.moveCall(
          '${SuiConfig.faucetPackageId}::faucet::mint_to_sender',
          arguments: [],
        );
      },
    );
  }

  Future<PendingBuyTransaction> _buildSimple({
    required String sender,
    required String description,
    required void Function(Transaction tx) build,
  }) async {
    final tx = Transaction();
    tx.setSender(sender);
    build(tx);
    final bytes = await tx.build(BuildOptions(client: _client));
    return PendingBuyTransaction(
      txJson: tx.toJson(),
      txBytesBase64: base64Encode(bytes),
      description: description,
    );
  }

  Future<PendingBuyTransaction> _buildWithUsdcPayment({
    required String sender,
    required int amountMist,
    required String description,
    required void Function(Transaction tx, TransactionResult payment) build,
  }) async {
    if (amountMist <= 0) {
      throw Exception('金额须大于 0');
    }
    final coins = await listUsdcCoins(sender);
    if (coins.isEmpty) {
      throw Exception('钱包中没有 USDC');
    }
    final total = coins.fold<BigInt>(
      BigInt.zero,
      (sum, coin) => sum + coin.balance,
    );
    final stake = BigInt.from(amountMist);
    if (total < stake) {
      throw Exception('USDC 不足');
    }
    final sorted = [...coins]
      ..sort((a, b) => b.balance.compareTo(a.balance));
    final primary = sorted.first.id;
    final mergeSources = sorted.skip(1).map((coin) => coin.id).toList();

    final tx = Transaction();
    tx.setSender(sender);
    if (mergeSources.isNotEmpty) {
      tx.mergeCoins(
        tx.object(primary),
        mergeSources.map(tx.object).toList(),
      );
    }
    final payment = tx.splitCoins(tx.object(primary), [stake]);
    build(tx, payment);
    final bytes = await tx.build(BuildOptions(client: _client));
    return PendingBuyTransaction(
      txJson: tx.toJson(),
      txBytesBase64: base64Encode(bytes),
      description: description,
    );
  }
}

typedef BuyTransactionService = ChainTransactionService;
