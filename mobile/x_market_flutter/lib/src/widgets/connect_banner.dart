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

class ConnectBanner extends StatelessWidget {
  const ConnectBanner({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (app.wallet.isConnected) {
      final usdc = app.walletSummary != null
          ? AppController.formatUsdc(app.walletSummary!.totalUsdcMist)
          : '—';
      return Material(
        color: Theme.of(context).colorScheme.primaryContainer,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.account_balance_wallet_outlined, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${app.wallet.address?.substring(0, 10)}…  ·  $usdc USDC',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              if (app.loadingWallet)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
        ),
      );
    }
    return Material(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Text(
                l10n.connectPhantomToTrade,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            FilledButton(
              onPressed: app.wallet.busy ? null : app.connectWallet,
              child: Text(l10n.connect),
            ),
          ],
        ),
      ),
    );
  }
}
