import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/models/prophet_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/prophet/prophecy_codec.dart';
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
          _message = '$e';
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
    final market = _selectedMarket;
    final eligibility = _eligibility;
    if (market == null) {
      setState(() => _message = '请选择市场');
      return;
    }
    if (eligibility == null || !eligibility.canCommit) {
      setState(() => _message = eligibility?.reason ?? '不可提交');
      return;
    }
    if (_analysis.text.trim().isEmpty) {
      setState(() => _message = '请填写分析内容');
      return;
    }
    final pv = int.tryParse(_predictedValue.text.trim());
    if (pv == null) {
      setState(() => _message = '预测值须为整数');
      return;
    }

    setState(() {
      _loading = true;
      _message = 'Indexer 上传明文 → 链上 Commit…';
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
    return ListenableBuilder(
      listenable: widget.app,
      builder: (context, _) {
        return Column(
          children: [
            Material(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: TabBar(
                controller: _tabs,
                tabs: const [
                  Tab(text: '发布'),
                  Tab(text: '排行榜'),
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
    final eligibility = _eligibility;
    return RefreshIndicator(
      onRefresh: _loadPoolData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ConnectBanner(app: widget.app),
          if (_myStats != null) ...[
            Text(
              '我的战绩：${ _myStats!.wins}胜 ${_myStats!.losses}负 · Score ${(_myStats!.scoreBps / 100).toStringAsFixed(1)} · 已审计 ${_myStats!.totalAudited}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              paidUnlockEligibilityHint(_myStats),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
          ],
          DropdownButtonFormField<MarketPoolSnapshot>(
            initialValue: _selectedMarket,
            decoration: const InputDecoration(labelText: '目标市场'),
            items: widget.app.markets
                .map(
                  (m) => DropdownMenuItem(
                    value: m,
                    child: Text(m.label, overflow: TextOverflow.ellipsis),
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
            Text(eligibility.reason, style: Theme.of(context).textTheme.bodySmall),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _predictedValue,
            decoration: InputDecoration(
              labelText: '预测值',
              helperText: _selectedMarket != null
                  ? '与 ${_selectedMarket!.kind} 分布结算单位一致'
                  : null,
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _analysis,
            decoration: const InputDecoration(
              labelText: '独家分析（明文）',
              alignLabelWithHint: true,
            ),
            minLines: 3,
            maxLines: 6,
          ),
          const SizedBox(height: 8),
          const Text(
            'Mobile P3：仅支持公开练手（unlock_price=0）。付费 Seal 加密预测请使用 Web /prophet。',
            style: TextStyle(fontSize: 12),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: widget.app.wallet.busy || _loading || eligibility?.canCommit != true
                ? null
                : _commitPublic,
            child: Text(_loading ? '处理中…' : 'Indexer 明文 → Commit 公开预测'),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!, style: Theme.of(context).textTheme.bodySmall),
          ],
          const Divider(height: 32),
          Text('本市场预测', style: Theme.of(context).textTheme.titleSmall),
          if (_prophecyIds.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('暂无预测'),
            )
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedProphecyId,
              decoration: const InputDecoration(labelText: '选择预测'),
              items: _prophecyIds
                  .map((id) => DropdownMenuItem(value: id, child: Text('${id.substring(0, 14)}…')))
                  .toList(),
              onChanged: (id) async {
                setState(() => _selectedProphecyId = id);
                await _loadSelectedProphecy();
              },
            ),
          if (_selectedProphecy != null) ...[
            Text('状态：${prophecyStatusLabel(_selectedProphecy!.status)}'),
            Text('预测值：${_selectedProphecy!.predictedValue}'),
            Text(
              _selectedProphecy!.isPublicProphecy ? '公开可读' : '私密（需 Web 解锁/Seal）',
            ),
          ],
          if (_publicContent != null) ...[
            const SizedBox(height: 8),
            Text('分析内容', style: Theme.of(context).textTheme.labelLarge),
            Text(_publicContent!.analysis),
          ],
        ],
      ),
    );
  }

  Widget _leaderboardTab() {
    return RefreshIndicator(
      onRefresh: _loadLeaderboard,
      child: _leaderboard.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                Center(child: Text('Indexer 离线或无排行数据')),
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
                    isMe ? '我 (${row.prophet.substring(0, 8)}…)' : '${row.prophet.substring(0, 10)}…',
                  ),
                  subtitle: Text(
                    '${row.wins}胜 ${row.losses}负 · Score ${(row.scoreBps / 100).toStringAsFixed(1)}'
                    '${row.paidUnlockEligible ? ' · 付费已开通' : ''}',
                  ),
                );
              },
            ),
    );
  }
}
