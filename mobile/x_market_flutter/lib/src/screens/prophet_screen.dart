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

import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/l10n/l10n_ext.dart';
import 'package:x_market_flutter/src/l10n/l10n_helpers.dart';
import 'package:x_market_flutter/src/models/prophet_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/prophet/prophet_eligibility.dart';
import 'package:x_market_flutter/src/widgets/connect_banner.dart';

class ProphetScreen extends StatefulWidget {
  const ProphetScreen({super.key, required this.app});

  final AppController app;

  @override
  State<ProphetScreen> createState() => _ProphetScreenState();
}

class _ProphetScreenState extends State<ProphetScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  MarketPoolSnapshot? _selectedMarket;
  final _predictedValue = TextEditingController(text: '2');
  final _analysis = TextEditingController();
  final _prophecyIds = <String>[];
  String? _selectedProphecyId;
  ProphecyView? _selectedProphecy;
  DecryptedProphecyContent? _publicContent;
  ProphetStatsView? _myStats;
  List<LeaderboardEntry> _leaderboard = const [];
  bool _loading = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    if (widget.app.markets.isNotEmpty) {
      _selectedMarket = widget.app.markets.first;
      _loadPoolData();
    }
    _loadLeaderboard();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _predictedValue.dispose();
    _analysis.dispose();
    super.dispose();
  }

  int get _nowSec => DateTime.now().millisecondsSinceEpoch ~/ 1000;

  ProphetMarketEligibility? get _eligibility {
    final market = _selectedMarket;
    if (market == null) return null;
    return assessProphetMarketEligibility(nowSec: _nowSec, market: market);
  }

  Future<void> _loadLeaderboard() async {
    final rows = await widget.app.prophet.fetchLeaderboard(limit: 50);
    if (mounted) setState(() => _leaderboard = rows);
  }

  Future<void> _loadPoolData() async {
    final market = _selectedMarket;
    if (market == null) return;
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final address = widget.app.wallet.address;
      final ids = await widget.app.prophet.discoverProphecyIds(market.poolId);
      final stats = address != null
          ? await widget.app.prophet.fetchProphetStats(address)
          : null;
      if (!mounted) return;
      setState(() {
        _prophecyIds
          ..clear()
          ..addAll(ids);
        _myStats = stats;
        _selectedProphecyId = ids.isNotEmpty ? ids.first : null;
        _loading = false;
      });
      if (_selectedProphecyId != null) {
        await _loadSelectedProphecy();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _message = localizeError(context.l10n, e);
        });
      }
    }
  }

  Future<void> _loadSelectedProphecy() async {
    final id = _selectedProphecyId;
    if (id == null) {
      setState(() {
        _selectedProphecy = null;
        _publicContent = null;
      });
      return;
    }
    final prophecy = await widget.app.prophet.fetchProphecy(id);
    DecryptedProphecyContent? content;
    if (prophecy != null) {
      content = await widget.app.prophet.readPublicContent(prophecy);
    }
    if (!mounted) return;
    setState(() {
      _selectedProphecy = prophecy;
      _publicContent = content;
    });
  }

  Future<void> _commitPublic() async {
    final l10n = context.l10n;
    final market = _selectedMarket;
    final eligibility = _eligibility;
    if (market == null) {
      setState(() => _message = l10n.selectMarket);
      return;
    }
    if (eligibility == null || !eligibility.canCommit) {
      setState(() => _message =
          eligibility?.localizedReason(l10n) ?? l10n.cannotSubmit);
      return;
    }
    if (_analysis.text.trim().isEmpty) {
      setState(() => _message = l10n.fillAnalysis);
      return;
    }
    final pv = int.tryParse(_predictedValue.text.trim());
    if (pv == null) {
      setState(() => _message = l10n.predictedValueMustBeInt);
      return;
    }

    setState(() {
      _loading = true;
      _message = l10n.committingProphecy;
    });

    await widget.app.submitChainTx(
      (sender) => widget.app.prophet.buildCommitPublicProphecy(
        sender: sender,
        poolId: market.poolId,
        predictedValue: pv,
        analysis: _analysis.text,
        lockTime: market.maturityTs,
      ),
    );

    if (!mounted) return;
    setState(() => _loading = false);
    if (widget.app.lastTxMessage != null) {
      setState(() => _message = widget.app.lastTxMessage);
    }
    await _loadPoolData();
    final address = widget.app.wallet.address;
    if (address != null) {
      final stats = await widget.app.prophet.fetchProphetStats(address);
      if (mounted) setState(() => _myStats = stats);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return ListenableBuilder(
      listenable: widget.app,
      builder: (context, _) {
        return Column(
          children: [
            Material(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: TabBar(
                controller: _tabs,
                tabs: [
                  Tab(text: l10n.tabPublish),
                  Tab(text: l10n.tabLeaderboard),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: [
                  _publishTab(),
                  _leaderboardTab(),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _publishTab() {
    final l10n = context.l10n;
    final eligibility = _eligibility;
    return RefreshIndicator(
      onRefresh: _loadPoolData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ConnectBanner(app: widget.app),
          if (_myStats != null) ...[
            Text(
              l10n.myStats(
                _myStats!.wins,
                _myStats!.losses,
                (_myStats!.scoreBps / 100).toStringAsFixed(1),
                _myStats!.totalAudited,
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              localizedPaidUnlockHint(l10n, _myStats),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
          ],
          DropdownButtonFormField<MarketPoolSnapshot>(
            initialValue: _selectedMarket,
            decoration: InputDecoration(labelText: l10n.targetMarket),
            items: widget.app.markets
                .map(
                  (m) => DropdownMenuItem(
                    value: m,
                    child: Text(displayMarketLabel(l10n, m), overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
            onChanged: (m) {
              setState(() => _selectedMarket = m);
              _loadPoolData();
            },
          ),
          if (eligibility != null) ...[
            const SizedBox(height: 8),
            Text(
              eligibility.localizedReason(l10n),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _predictedValue,
            decoration: InputDecoration(
              labelText: l10n.predictedValue,
              helperText: _selectedMarket != null
                  ? l10n.predictedValueHelper(_selectedMarket!.kind)
                  : null,
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _analysis,
            decoration: InputDecoration(
              labelText: l10n.exclusiveAnalysis,
              alignLabelWithHint: true,
            ),
            minLines: 3,
            maxLines: 6,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.mobileP3Hint,
            style: const TextStyle(fontSize: 12),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: widget.app.wallet.busy || _loading || eligibility?.canCommit != true
                ? null
                : _commitPublic,
            child: Text(
              _loading ? l10n.processing : l10n.commitPublicProphecy,
            ),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!, style: Theme.of(context).textTheme.bodySmall),
          ],
          const Divider(height: 32),
          Text(l10n.poolProphecies, style: Theme.of(context).textTheme.titleSmall),
          if (_prophecyIds.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(l10n.noProphecies),
            )
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedProphecyId,
              decoration: InputDecoration(labelText: l10n.selectProphecy),
              items: _prophecyIds
                  .map((id) => DropdownMenuItem(value: id, child: Text('${id.substring(0, 14)}…')))
                  .toList(),
              onChanged: (id) async {
                setState(() => _selectedProphecyId = id);
                await _loadSelectedProphecy();
              },
            ),
          if (_selectedProphecy != null) ...[
            Text(
              l10n.prophecyStatus(
                localizedProphecyStatus(l10n, _selectedProphecy!.status),
              ),
            ),
            Text(l10n.prophecyValue('${_selectedProphecy!.predictedValue}')),
            Text(
              _selectedProphecy!.isPublicProphecy
                  ? l10n.prophecyPublicReadable
                  : l10n.prophecyPrivateWeb,
            ),
          ],
          if (_publicContent != null) ...[
            const SizedBox(height: 8),
            Text(l10n.analysisContent, style: Theme.of(context).textTheme.labelLarge),
            Text(_publicContent!.analysis),
          ],
        ],
      ),
    );
  }

  Widget _leaderboardTab() {
    final l10n = context.l10n;
    return RefreshIndicator(
      onRefresh: _loadLeaderboard,
      child: _leaderboard.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 120),
                Center(child: Text(l10n.leaderboardEmpty)),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _leaderboard.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final row = _leaderboard[index];
                final isMe = row.prophet == widget.app.wallet.address;
                return ListTile(
                  leading: CircleAvatar(child: Text('${row.rank}')),
                  title: Text(
                    isMe
                        ? l10n.leaderboardMe(row.prophet.substring(0, 8))
                        : '${row.prophet.substring(0, 10)}…',
                  ),
                  subtitle: Text(
                    l10n.leaderboardRow(
                      row.wins,
                      row.losses,
                      (row.scoreBps / 100).toStringAsFixed(1),
                      row.paidUnlockEligible ? l10n.paidUnlockEnabled : '',
                    ),
                  ),
                );
              },
            ),
    );
  }
}
