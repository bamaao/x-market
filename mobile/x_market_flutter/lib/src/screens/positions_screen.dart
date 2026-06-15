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
import 'package:x_market_flutter/src/widgets/connect_banner.dart';
import 'package:x_market_flutter/src/widgets/cross_margin_var_banner.dart';

class PositionsScreen extends StatelessWidget {
  const PositionsScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
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
                    ? SliverFillRemaining(
                        child: Center(child: Text(l10n.noPositions)),
                      )
                    : SliverList.separated(
                        itemCount: app.positions.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final p = app.positions[index];
                          final poolId = p.poolId;
                          final marketRef = app.marketRefFor(poolId);
                          final canClaim =
                              !p.claimed && poolId != null && poolId.isNotEmpty;
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    app.poolLabelFor(poolId),
                                    style:
                                        Theme.of(context).textTheme.titleSmall,
                                  ),
                                  if (marketRef != null &&
                                      marketRef.description.isNotEmpty)
                                    Text(
                                      marketRef.description,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style:
                                          Theme.of(context).textTheme.bodySmall,
                                    ),
                                  Text(
                                    '${p.kindLabel} · ${marketRef?.kind.toUpperCase() ?? '—'}',
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
                                    Text(l10n.claimed)
                                  else if (poolId == null || poolId.isEmpty)
                                    Text(l10n.missingPoolId)
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
                                      child: Text(l10n.claimPayout),
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
