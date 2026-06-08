import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/trade/buy_transaction_service.dart';

class MarketDetailScreen extends StatefulWidget {
  const MarketDetailScreen({
    super.key,
    required this.app,
    required this.market,
  });

  final AppController app;
  final MarketPoolSnapshot market;

  @override
  State<MarketDetailScreen> createState() => _MarketDetailScreenState();
}

class _MarketDetailScreenState extends State<MarketDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  ContractMode _mode = ContractMode.interval;
  final _stake = TextEditingController(text: '1');
  final _poissonA = TextEditingController(text: '2');
  final _poissonB = TextEditingController(text: '3');
  final _poissonK = TextEditingController(text: '2');
  final _dirichletOutcome = TextEditingController(text: '0');
  final _betaA = TextEditingController(text: '350');
  final _betaB = TextEditingController(text: '400');
  final _normalA = TextEditingController(text: '25');
  final _normalB = TextEditingController(text: '27');
  final _normalThreshold = TextEditingController(text: '30');
  final _normalStrike = TextEditingController(text: '25');
  final _normalCap = TextEditingController(text: '30');
  final _normalLower = TextEditingController(text: '24');
  final _normalUpper = TextEditingController(text: '28');
  final _normalBarrier = TextEditingController(text: '26');
  final _lpAmount = TextEditingController(text: '10');
  final _auctionAmount = TextEditingController(text: '5');
  final _auctionBucket = TextEditingController(text: '0');

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    _stake.dispose();
    _poissonA.dispose();
    _poissonB.dispose();
    _poissonK.dispose();
    _dirichletOutcome.dispose();
    _betaA.dispose();
    _betaB.dispose();
    _normalA.dispose();
    _normalB.dispose();
    _normalThreshold.dispose();
    _normalStrike.dispose();
    _normalCap.dispose();
    _normalLower.dispose();
    _normalUpper.dispose();
    _normalBarrier.dispose();
    _lpAmount.dispose();
    _auctionAmount.dispose();
    _auctionBucket.dispose();
    super.dispose();
  }

  BuyParams _buyParams() {
    return BuyParams(
      poolId: widget.market.poolId,
      marketKind: widget.market.kind,
      mode: widget.market.kind == 'dirichlet' || widget.market.kind == 'beta'
          ? ContractMode.interval
          : _mode,
      poissonA: int.parse(_poissonA.text.trim()),
      poissonB: int.parse(_poissonB.text.trim()),
      poissonK: int.parse(_poissonK.text.trim()),
      dirichletOutcome: int.parse(_dirichletOutcome.text.trim()),
      normalA: int.parse(_normalA.text.trim()),
      normalB: int.parse(_normalB.text.trim()),
      normalThreshold: int.parse(_normalThreshold.text.trim()),
      normalStrike: int.parse(_normalStrike.text.trim()),
      normalCap: int.parse(_normalCap.text.trim()),
      normalLower: int.parse(_normalLower.text.trim()),
      normalUpper: int.parse(_normalUpper.text.trim()),
      normalBarrier: int.parse(_normalBarrier.text.trim()),
      betaA: int.parse(_betaA.text.trim()),
      betaB: int.parse(_betaB.text.trim()),
    );
  }

  Future<void> _buy() async {
    final params = _buyParams();
    params.validate();
    final stake = widget.app.tx.parseUsdcAmount(_stake.text);
    await widget.app.submitChainTx(
      (sender) => widget.app.tx.buildBuy(
        sender: sender,
        params: params,
        stakeUsdcMist: stake,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final market = widget.market;
    final modes = ChainTransactionService.modesForMarketKind(market.kind);
    return Scaffold(
      appBar: AppBar(
        title: Text(market.label),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: '交易'),
            Tab(text: 'LP'),
            Tab(text: '拍卖'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _tradeTab(modes),
          _lpTab(),
          _auctionTab(),
        ],
      ),
    );
  }

  Widget _tradeTab(List<ContractMode> modes) {
    final kind = widget.market.kind;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (kind == 'dirichlet')
          TextField(
            controller: _dirichletOutcome,
            decoration: const InputDecoration(labelText: '结果 0/1/2'),
            keyboardType: TextInputType.number,
          )
        else if (kind == 'beta')
          const SizedBox.shrink()
        else
          DropdownButtonFormField<ContractMode>(
            initialValue: modes.contains(_mode) ? _mode : modes.first,
            decoration: const InputDecoration(labelText: '合约类型'),
            items: modes
                .map(
                  (m) => DropdownMenuItem(value: m, child: Text(m.label)),
                )
                .toList(),
            onChanged: (v) => setState(() => _mode = v ?? _mode),
          ),
        const SizedBox(height: 12),
        ..._paramFields(kind),
        TextField(
          controller: _stake,
          decoration: const InputDecoration(labelText: 'Stake (USDC)'),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: widget.app.wallet.busy ? null : _buy,
          child: const Text('Phantom 签名并买入'),
        ),
      ],
    );
  }

  List<Widget> _paramFields(String kind) {
    if (kind == 'beta') {
      return [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _betaA,
                decoration: const InputDecoration(labelText: '下界 ‰'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _betaB,
                decoration: const InputDecoration(labelText: '上界 ‰'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'poisson' && _mode == ContractMode.interval) {
      return [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _poissonA,
                decoration: const InputDecoration(labelText: 'a'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _poissonB,
                decoration: const InputDecoration(labelText: 'b'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'poisson' && _mode == ContractMode.digital) {
      return [
        TextField(
          controller: _poissonK,
          decoration: const InputDecoration(labelText: 'k'),
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'normal' && _mode == ContractMode.interval) {
      return [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _normalA,
                decoration: const InputDecoration(labelText: '下界'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _normalB,
                decoration: const InputDecoration(labelText: '上界'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'normal' && _mode == ContractMode.digital) {
      return [
        TextField(
          controller: _normalThreshold,
          decoration: const InputDecoration(labelText: '阈值'),
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'normal' &&
        (_mode == ContractMode.linearCall ||
            _mode == ContractMode.linearPut ||
            _mode == ContractMode.straddle ||
            _mode == ContractMode.varianceSwap)) {
      return [
        TextField(
          controller: _normalStrike,
          decoration: const InputDecoration(labelText: '执行价 K'),
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'normal' && _mode == ContractMode.structuredNote) {
      return [
        TextField(
          controller: _normalStrike,
          decoration: const InputDecoration(labelText: 'K'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _normalCap,
          decoration: const InputDecoration(labelText: 'C'),
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'normal' && _mode == ContractMode.rangeNote) {
      return [
        TextField(
          controller: _normalLower,
          decoration: const InputDecoration(labelText: 'L'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _normalUpper,
          decoration: const InputDecoration(labelText: 'U'),
        ),
        const SizedBox(height: 12),
      ];
    }
    if (kind == 'normal' && _mode == ContractMode.barrierNote) {
      return [
        TextField(
          controller: _normalBarrier,
          decoration: const InputDecoration(labelText: '障碍 B'),
        ),
        const SizedBox(height: 12),
      ];
    }
    return const [SizedBox(height: 4)];
  }

  Widget _lpTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _lpAmount,
          decoration: const InputDecoration(labelText: '申购 USDC'),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: widget.app.wallet.busy
              ? null
              : () async {
                  final amount = widget.app.tx.parseUsdcAmount(_lpAmount.text);
                  await widget.app.submitChainTx(
                    (sender) => widget.app.tx.buildDepositLiquidity(
                      sender: sender,
                      poolId: widget.market.poolId,
                      amountUsdcMist: amount,
                    ),
                  );
                },
          child: const Text('LP 申购'),
        ),
      ],
    );
  }

  Widget _auctionTab() {
    final canAuction = widget.market.kind == 'poisson' ||
        widget.market.kind == 'dirichlet' ||
        widget.market.kind == 'normal';
    if (!canAuction) {
      return const Center(child: Text('该市场不支持 Opening Auction'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _auctionBucket,
          decoration: const InputDecoration(labelText: '桶索引 bucket'),
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _auctionAmount,
          decoration: const InputDecoration(labelText: '出价 USDC'),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: widget.app.wallet.busy
              ? null
              : () async {
                  final amount = widget.app.tx.parseUsdcAmount(
                    _auctionAmount.text,
                  );
                  await widget.app.submitChainTx(
                    (sender) => widget.app.tx.buildAuctionBid(
                      sender: sender,
                      poolId: widget.market.poolId,
                      amountUsdcMist: amount,
                      bucketIndex: int.parse(_auctionBucket.text.trim()),
                    ),
                  );
                },
          child: const Text('拍卖出价'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: widget.app.wallet.busy
              ? null
              : () => widget.app.submitChainTx(
                  (sender) => widget.app.tx.buildFinalizeAuction(
                    sender: sender,
                    poolId: widget.market.poolId,
                    marketKind: widget.market.kind,
                  ),
                ),
          child: const Text('定标 finalize_auction'),
        ),
      ],
    );
  }
}
