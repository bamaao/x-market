import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/models/owned_models.dart';
import 'package:x_market_flutter/src/widgets/connect_banner.dart';
import 'package:x_market_flutter/src/widgets/cross_margin_var_banner.dart';

class MarginScreen extends StatefulWidget {
  const MarginScreen({super.key, required this.app});

  final AppController app;

  @override
  State<MarginScreen> createState() => _MarginScreenState();
}

class _MarginScreenState extends State<MarginScreen> {
  String? _openPoolId;
  String? _selectedPositionId;
  final _marginAccountId = TextEditingController();
  MarginAccountSnapshot? _selectedAccount;

  @override
  void dispose() {
    _marginAccountId.dispose();
    super.dispose();
  }

  String? get _registerPoolId =>
      _selectedAccount?.poolId ?? _openPoolId;

  void _selectMarginAccount(MarginAccountSnapshot account) {
    setState(() {
      _selectedAccount = account;
      _marginAccountId.text = account.objectId;
      _selectedPositionId = null;
      if (account.poolId != null &&
          widget.app.markets.any((m) => m.poolId == account.poolId)) {
        _openPoolId = account.poolId;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final eligiblePositions = _selectedAccount?.poolId == null
        ? widget.app.positions.where((p) => !p.claimed).toList()
        : widget.app.positionsForPool(_selectedAccount!.poolId);

    return ListenableBuilder(
      listenable: widget.app,
      builder: (context, _) {
        return RefreshIndicator(
          onRefresh: widget.app.refreshWalletData,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: ConnectBanner(app: widget.app)),
              if (widget.app.wallet.isConnected &&
                  widget.app.positions.isNotEmpty)
                SliverToBoxAdapter(
                  child: CrossMarginVarBanner(
                    varMist: widget.app.crossMarginVarMist,
                    positionCount: widget.app.positions.length,
                    subtitle: '钱包持仓组合估算；登记到保证金账户后以链上 liability 为准',
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<String>(
                        key: ValueKey('open-pool-$_openPoolId'),
                        initialValue: _openPoolId,
                        decoration: const InputDecoration(
                          labelText: '市场（开户）',
                        ),
                        items: widget.app.markets
                            .map(
                              (m) => DropdownMenuItem(
                                value: m.poolId,
                                child: Text(m.label),
                              ),
                            )
                            .toList(),
                        onChanged: widget.app.wallet.busy
                            ? null
                            : (poolId) => setState(() => _openPoolId = poolId),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: widget.app.wallet.busy ||
                                _openPoolId == null ||
                                _openPoolId!.isEmpty
                            ? null
                            : () => widget.app.submitChainTx(
                                  (sender) =>
                                      widget.app.tx.buildOpenMarginAccount(
                                    sender: sender,
                                    poolId: _openPoolId!,
                                  ),
                                ),
                        child: const Text('开设保证金账户'),
                      ),
                      const Divider(height: 32),
                      TextField(
                        controller: _marginAccountId,
                        decoration: const InputDecoration(
                          labelText: 'MarginAccount ID',
                          hintText: '点击下方账户卡片自动填入',
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 8),
                      if (eligiblePositions.isNotEmpty) ...[
                        DropdownButtonFormField<String>(
                          key: ValueKey('position-$_selectedPositionId'),
                          initialValue: _selectedPositionId,
                          decoration: const InputDecoration(
                            labelText: '持仓（同池）',
                          ),
                          items: eligiblePositions
                              .map(
                                (p) => DropdownMenuItem(
                                  value: p.objectId,
                                  child: Text(
                                    '${p.kindLabel} · ${AppController.formatUsdc(p.stakeUsdcMist)} USDC',
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: widget.app.wallet.busy
                              ? null
                              : (positionId) => setState(
                                    () => _selectedPositionId = positionId,
                                  ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      FilledButton.tonal(
                        onPressed: widget.app.wallet.busy ||
                                _marginAccountId.text.trim().isEmpty ||
                                _registerPoolId == null ||
                                _registerPoolId!.isEmpty ||
                                _selectedPositionId == null ||
                                _selectedPositionId!.isEmpty
                            ? null
                            : () => widget.app.submitChainTx(
                                  (sender) =>
                                      widget.app.tx.buildRegisterPosition(
                                    sender: sender,
                                    marginAccountId:
                                        _marginAccountId.text.trim(),
                                    poolId: _registerPoolId!,
                                    positionId: _selectedPositionId!,
                                  ),
                                ),
                        child: const Text('登记持仓'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: widget.app.wallet.busy ||
                                _marginAccountId.text.trim().isEmpty ||
                                _registerPoolId == null ||
                                _registerPoolId!.isEmpty ||
                                _selectedPositionId == null ||
                                _selectedPositionId!.isEmpty
                            ? null
                            : () => widget.app.submitChainTx(
                                  (sender) =>
                                      widget.app.tx.buildUnregisterPosition(
                                    sender: sender,
                                    marginAccountId:
                                        _marginAccountId.text.trim(),
                                    poolId: _registerPoolId!,
                                    positionId: _selectedPositionId!,
                                  ),
                                ),
                        child: const Text('取消登记'),
                      ),
                    ],
                  ),
                ),
              ),
              if (widget.app.marginAccounts.isNotEmpty)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  sliver: SliverList.separated(
                    itemCount: widget.app.marginAccounts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final m = widget.app.marginAccounts[index];
                      final selected = _selectedAccount?.objectId == m.objectId;
                      return Card(
                        color: selected
                            ? Theme.of(context)
                                .colorScheme
                                .primaryContainer
                                .withValues(alpha: 0.35)
                            : null,
                        child: ListTile(
                          onTap: () => _selectMarginAccount(m),
                          title: Text(widget.app.poolLabelFor(m.poolId)),
                          subtitle: Text(
                            '持仓 ${m.positionCount} · '
                            'Gross ${AppController.formatUsdc(m.grossStakeUsdcMist)} USDC · '
                            'Worst ${AppController.formatUsdc(m.worstLiabilityMist)} USDC\n'
                            '${m.objectId.substring(0, 18)}…',
                          ),
                          isThreeLine: true,
                          trailing: selected
                              ? Icon(
                                  Icons.check_circle,
                                  color: Theme.of(context).colorScheme.primary,
                                )
                              : null,
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
