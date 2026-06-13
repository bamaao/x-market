import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
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
                      'Phantom 钱包',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      w.isConnected
                          ? w.address ?? ''
                          : '未连接 · Testnet',
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
                        child: const Text('断开连接'),
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
                            : const Text('连接 Phantom'),
                      ),
                    const SizedBox(height: 8),
                    if (SuiConfig.network == 'testnet')
                      Text(
                        '测试网 USDC 请从 Circle 水龙头领取或转入钱包',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: w.isConnected && !w.busy
                          ? app.refreshWalletData
                          : null,
                      child: const Text('刷新余额与资产'),
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
              Text('最近: ${app.lastTxMessage}'),
            ],
            if (kDebugMode) ...[
              const SizedBox(height: 24),
              Text(
                'Testnet · ${DateTime.now().year}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        );
      },
    );
  }
}
