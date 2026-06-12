import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
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
        title: const Text('X-Market'),
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
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: '市场',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: '持仓',
          ),
          NavigationDestination(
            icon: Icon(Icons.water_drop_outlined),
            selectedIcon: Icon(Icons.water_drop),
            label: 'LP',
          ),
          NavigationDestination(
            icon: Icon(Icons.auto_awesome_outlined),
            selectedIcon: Icon(Icons.auto_awesome),
            label: 'Prophet',
          ),
          NavigationDestination(
            icon: Icon(Icons.security_outlined),
            selectedIcon: Icon(Icons.security),
            label: '保证金',
          ),
          NavigationDestination(
            icon: Icon(Icons.wallet_outlined),
            selectedIcon: Icon(Icons.wallet),
            label: '钱包',
          ),
        ],
      ),
    );
  }
}
