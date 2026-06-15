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

import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/l10n/l10n_ext.dart';
import 'package:x_market_flutter/src/l10n/l10n_helpers.dart';
import 'package:x_market_flutter/src/models/pricing_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/services/pricing_service.dart';
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

  QuotePreview? _quote;
  bool _loadingQuote = false;
  Timer? _quoteDebounce;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    for (final controller in _quoteControllers) {
      controller.addListener(_scheduleQuoteRefresh);
    }
    _scheduleQuoteRefresh();
  }

  List<TextEditingController> get _quoteControllers => [
    _stake,
    _poissonA,
    _poissonB,
    _poissonK,
    _dirichletOutcome,
    _betaA,
    _betaB,
    _normalA,
    _normalB,
    _normalThreshold,
    _normalStrike,
    _normalCap,
    _normalLower,
    _normalUpper,
    _normalBarrier,
  ];

  void _scheduleQuoteRefresh() {
    _quoteDebounce?.cancel();
    _quoteDebounce = Timer(const Duration(milliseconds: 350), () {
      unawaited(_refreshQuote());
    });
  }

  Future<void> _refreshQuote() async {
    if (!widget.app.pricingEnabled ||
        !PricingService.supportsMarketKind(widget.market.kind)) {
      if (mounted) setState(() => _quote = null);
      return;
    }
    setState(() => _loadingQuote = true);
    try {
      final params = _buyParams();
      final stake = widget.app.tx.parseUsdcAmount(_stake.text);
      final quote = await widget.app.pricing.fetchQuotePreview(
        market: widget.market,
        params: params,
        stakeUsdcMist: stake,
      );
      if (mounted) {
        setState(() {
          _quote = quote;
          _loadingQuote = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _quote = null;
          _loadingQuote = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _quoteDebounce?.cancel();
    for (final controller in _quoteControllers) {
      controller.removeListener(_scheduleQuoteRefresh);
    }
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
    final l10n = context.l10n;
    final market = widget.market;
    final modes = ChainTransactionService.modesForMarketKind(market.kind);
    return Scaffold(
      appBar: AppBar(
        title: Text(displayMarketLabel(context.l10n, market)),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(text: l10n.tabTrade),
            Tab(text: l10n.navLp),
            Tab(text: l10n.tabAuction),
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
    final l10n = context.l10n;
    final kind = widget.market.kind;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (widget.app.gasStationEnabled)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              widget.app.gasStationReachable
                  ? l10n.gasStationEnabled
                  : l10n.gasStationOffline,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        if (kind == 'dirichlet')
          TextField(
            controller: _dirichletOutcome,
            decoration: InputDecoration(labelText: l10n.outcome012),
            keyboardType: TextInputType.number,
          )
        else if (kind == 'beta')
          const SizedBox.shrink()
        else
          DropdownButtonFormField<ContractMode>(
            initialValue: modes.contains(_mode) ? _mode : modes.first,
            decoration: InputDecoration(labelText: l10n.contractType),
            items: modes
                .map(
                  (m) => DropdownMenuItem(
                    value: m,
                    child: Text(m.localizedLabel(l10n)),
                  ),
                )
                .toList(),
            onChanged: (v) {
              setState(() => _mode = v ?? _mode);
              _scheduleQuoteRefresh();
            },
          ),
        const SizedBox(height: 12),
        ..._paramFields(kind),
        TextField(
          controller: _stake,
          decoration: InputDecoration(labelText: l10n.stakeUsdc),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        const SizedBox(height: 12),
        _QuotePreviewPanel(quote: _quote, loading: _loadingQuote, kind: kind),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: widget.app.wallet.busy ? null : _buy,
          child: Text(
            widget.app.gasStationReachable
                ? l10n.buyWithGasSponsor
                : l10n.buyWithPhantom,
          ),
        ),
      ],
    );
  }

  List<Widget> _paramFields(String kind) {
    final l10n = context.l10n;
    if (kind == 'beta') {
      return [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _betaA,
                decoration: InputDecoration(labelText: l10n.lowerBoundPermille),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _betaB,
                decoration: InputDecoration(labelText: l10n.upperBoundPermille),
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
                decoration: InputDecoration(labelText: l10n.lowerBound),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _normalB,
                decoration: InputDecoration(labelText: l10n.upperBound),
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
          decoration: InputDecoration(labelText: l10n.threshold),
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
          decoration: InputDecoration(labelText: l10n.strikeK),
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
          decoration: InputDecoration(labelText: l10n.barrierB),
        ),
        const SizedBox(height: 12),
      ];
    }
    return const [SizedBox(height: 4)];
  }

  Widget _lpTab() {
    final l10n = context.l10n;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _lpAmount,
          decoration: InputDecoration(labelText: l10n.subscribeUsdc),
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
          child: Text(l10n.lpSubscribe),
        ),
      ],
    );
  }

  Widget _auctionTab() {
    final l10n = context.l10n;
    final canAuction = widget.market.kind == 'poisson' ||
        widget.market.kind == 'dirichlet' ||
        widget.market.kind == 'normal';
    if (!canAuction) {
      return Center(child: Text(l10n.auctionNotSupported));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _auctionBucket,
          decoration: InputDecoration(labelText: l10n.bucketIndex),
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _auctionAmount,
          decoration: InputDecoration(labelText: l10n.bidUsdc),
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
          child: Text(l10n.auctionBid),
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
          child: Text(l10n.finalizeAuction),
        ),
      ],
    );
  }
}

class _QuotePreviewPanel extends StatelessWidget {
  const _QuotePreviewPanel({
    required this.quote,
    required this.loading,
    required this.kind,
  });

  final QuotePreview? quote;
  final bool loading;
  final String kind;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (!PricingService.supportsMarketKind(kind)) {
      return Text(
        l10n.quoteBetaUnsupported,
        style: Theme.of(context).textTheme.bodySmall,
      );
    }
    if (loading) {
      return const LinearProgressIndicator(minHeight: 2);
    }
    if (quote == null) {
      return Text(
        l10n.quoteUnavailable,
        style: Theme.of(context).textTheme.bodySmall,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.quoteTitle, style: Theme.of(context).textTheme.labelLarge),
        Text(l10n.quoteWinProb(quote!.entryProbPercent.toStringAsFixed(2))),
        Text(
          l10n.quotePayout(AppController.formatUsdc(quote!.payoutUsdcMist)),
        ),
        Text(l10n.quoteImpliedRoi((quote!.impliedRoiBps / 100).toStringAsFixed(2))),
      ],
    );
  }
}
