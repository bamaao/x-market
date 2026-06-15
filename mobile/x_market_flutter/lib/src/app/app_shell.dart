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
import 'package:x_market_flutter/src/screens/lp_screen.dart';
import 'package:x_market_flutter/src/screens/margin_screen.dart';
import 'package:x_market_flutter/src/screens/markets_screen.dart';
import 'package:x_market_flutter/src/screens/prophet_screen.dart';
import 'package:x_market_flutter/src/screens/positions_screen.dart';
import 'package:x_market_flutter/src/screens/wallet_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.app});

  final AppController app;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final pages = [
      MarketsScreen(app: widget.app),
      PositionsScreen(app: widget.app),
      LpScreen(app: widget.app),
      ProphetScreen(app: widget.app),
      MarginScreen(app: widget.app),
      WalletScreen(app: widget.app),
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appTitle),
        actions: [
          if (widget.app.wallet.busy)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
        ],
      ),
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          setState(() => _index = i);
          if (i > 0 && widget.app.wallet.isConnected) {
            widget.app.refreshWalletData();
          }
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.storefront_outlined),
            selectedIcon: const Icon(Icons.storefront),
            label: l10n.navMarkets,
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long),
            label: l10n.navPositions,
          ),
          NavigationDestination(
            icon: const Icon(Icons.water_drop_outlined),
            selectedIcon: const Icon(Icons.water_drop),
            label: l10n.navLp,
          ),
          NavigationDestination(
            icon: const Icon(Icons.auto_awesome_outlined),
            selectedIcon: const Icon(Icons.auto_awesome),
            label: l10n.navProphet,
          ),
          NavigationDestination(
            icon: const Icon(Icons.security_outlined),
            selectedIcon: const Icon(Icons.security),
            label: l10n.navMargin,
          ),
          NavigationDestination(
            icon: const Icon(Icons.wallet_outlined),
            selectedIcon: const Icon(Icons.wallet),
            label: l10n.navWallet,
          ),
        ],
      ),
    );
  }
}
