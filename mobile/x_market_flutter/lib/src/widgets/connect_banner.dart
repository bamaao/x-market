import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';

class ConnectBanner extends StatelessWidget {
  const ConnectBanner({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
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
                '连接 Phantom 钱包以交易',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            FilledButton(
              onPressed: app.wallet.busy ? null : app.connectWallet,
              child: const Text('连接'),
            ),
          ],
        ),
      ),
    );
  }
}
