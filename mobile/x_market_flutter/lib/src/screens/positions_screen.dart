import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/widgets/connect_banner.dart';
import 'package:x_market_flutter/src/widgets/cross_margin_var_banner.dart';

class PositionsScreen extends StatelessWidget {
  const PositionsScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        return RefreshIndicator(
          onRefresh: app.refreshWalletData,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: ConnectBanner(app: app)),
              if (app.wallet.isConnected && app.positions.isNotEmpty)
                SliverToBoxAdapter(
                  child: CrossMarginVarBanner(
                    varMist: app.crossMarginVarMist,
                    positionCount: app.positions.length,
                  ),
                ),
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: app.positions.isEmpty
                    ? const SliverFillRemaining(
                        child: Center(child: Text('暂无持仓')),
                      )
                    : SliverList.separated(
                        itemCount: app.positions.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final p = app.positions[index];
                          final poolId = p.poolId;
                          final canClaim =
                              !p.claimed && poolId != null && poolId.isNotEmpty;
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    p.kindLabel,
                                    style:
                                        Theme.of(context).textTheme.titleSmall,
                                  ),
                                  Text(
                                    app.poolLabelFor(poolId),
                                    style:
                                        Theme.of(context).textTheme.labelLarge,
                                  ),
                                  Text(
                                    '${p.objectId.substring(0, 14)}…',
                                    style:
                                        Theme.of(context).textTheme.bodySmall,
                                  ),
                                  Text(
                                    'Stake ${AppController.formatUsdc(p.stakeUsdcMist)} USDC · [${p.intervalA}, ${p.intervalB}]',
                                  ),
                                  if (p.claimed)
                                    const Text('已领取')
                                  else if (poolId == null || poolId.isEmpty)
                                    const Text('无法关联 Pool ID（链上 market_id 缺失）')
                                  else ...[
                                    const SizedBox(height: 8),
                                    FilledButton.tonal(
                                      onPressed: app.wallet.busy || !canClaim
                                          ? null
                                          : () => app.submitChainTx(
                                                (sender) => app.tx
                                                    .buildClaimPosition(
                                                  sender: sender,
                                                  poolId: poolId,
                                                  positionId: p.objectId,
                                                ),
                                              ),
                                      child: const Text('领取赔付'),
                                    ),
                                  ],
                                ],
                              ),
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
