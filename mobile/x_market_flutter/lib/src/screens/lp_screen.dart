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

class LpScreen extends StatelessWidget {
  const LpScreen({super.key, required this.app});

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
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: app.lpShares.isEmpty
                    ? SliverFillRemaining(
                        child: Center(child: Text(l10n.noLpShares)),
                      )
                    : SliverList.separated(
                        itemCount: app.lpShares.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final lp = app.lpShares[index];
                          final poolId = lp.poolId;
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
                                  Text(
                                    l10n.lpShares(
                                      AppController.formatUsdc(lp.shares),
                                    ),
                                  ),
                                  Text(
                                    lp.objectId.substring(0, 18),
                                    style:
                                        Theme.of(context).textTheme.bodySmall,
                                  ),
                                  const SizedBox(height: 8),
                                  FilledButton.tonal(
                                    onPressed: app.wallet.busy ||
                                            poolId == null ||
                                            poolId.isEmpty
                                        ? null
                                        : () => app.submitChainTx(
                                              (sender) =>
                                                  app.tx.buildWithdrawLiquidity(
                                                sender: sender,
                                                poolId: poolId,
                                                lpShareId: lp.objectId,
                                              ),
                                            ),
                                    child: Text(l10n.redeemLp),
                                  ),
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
