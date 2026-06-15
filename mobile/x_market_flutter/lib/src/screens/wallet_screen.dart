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

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/l10n/l10n_ext.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        final w = app.wallet;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.phantomWallet,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      w.isConnected
                          ? w.address ?? ''
                          : l10n.notConnectedTestnet,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    if (app.walletSummary != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'USDC: ${AppController.formatUsdc(app.walletSummary!.totalUsdcMist)}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ],
                    const SizedBox(height: 16),
                    if (w.isConnected)
                      OutlinedButton(
                        onPressed: w.busy ? null : app.disconnectWallet,
                        child: Text(l10n.disconnect),
                      )
                    else
                      FilledButton(
                        onPressed: w.busy ? null : app.connectWallet,
                        child: w.busy
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(l10n.connectPhantom),
                      ),
                    const SizedBox(height: 8),
                    if (SuiConfig.network == 'testnet')
                      Text(
                        l10n.testnetUsdcHint,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: w.isConnected && !w.busy
                          ? app.refreshWalletData
                          : null,
                      child: Text(l10n.refreshBalanceAndAssets),
                    ),
                  ],
                ),
              ),
            ),
            if (w.statusMessage != null) ...[
              const SizedBox(height: 12),
              Text(w.statusMessage!),
            ],
            if (w.errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                w.errorMessage!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            if (app.lastTxMessage != null) ...[
              const SizedBox(height: 8),
              Text(l10n.recentTx(app.lastTxMessage!)),
            ],
            if (kDebugMode) ...[
              const SizedBox(height: 24),
              Text(
                l10n.testnetYear(DateTime.now().year),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        );
      },
    );
  }
}
