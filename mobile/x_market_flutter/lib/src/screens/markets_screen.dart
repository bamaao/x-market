import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/l10n/l10n_ext.dart';
import 'package:x_market_flutter/src/l10n/l10n_helpers.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/widgets/connect_banner.dart';
import 'package:x_market_flutter/src/screens/market_detail_screen.dart';

class MarketsScreen extends StatelessWidget {
  const MarketsScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        return RefreshIndicator(
          onRefresh: app.refreshMarkets,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: ConnectBanner(app: app)),
              if (app.indexerEnabled)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: _IndexerSourceBadge(app: app),
                  ),
                ),
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: app.loadingMarkets && app.markets.isEmpty
                    ? const SliverFillRemaining(
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : SliverList.separated(
                        itemCount: app.markets.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final market = app.markets[index];
                          return _MarketCard(
                            market: market,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) =>
                                    MarketDetailScreen(app: app, market: market),
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

class _IndexerSourceBadge extends StatelessWidget {
  const _IndexerSourceBadge({required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colorScheme = Theme.of(context).colorScheme;
    final online = app.indexerReachable;
    final label = !online
        ? l10n.indexerOfflineUsingSeeds
        : app.marketSourceIsIndexer
        ? l10n.indexerApiLive
        : l10n.seedsNoIndexerMetadata;

    return Row(
      children: [
        Icon(
          Icons.circle,
          size: 10,
          color: online ? colorScheme.primary : colorScheme.outline,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      ],
    );
  }
}

class _MarketCard extends StatelessWidget {
  const _MarketCard({required this.market, required this.onTap});

  final MarketPoolSnapshot market;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                displayMarketLabel(l10n, market),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (market.description != null && market.description!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  market.description!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              const SizedBox(height: 4),
              Text('${market.kind.toUpperCase()} · ${market.statusLabel}'),
              if (market.tags.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    for (final tag in market.tags.take(4))
                      Chip(
                        label: Text(tag),
                        visualDensity: VisualDensity.compact,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        padding: EdgeInsets.zero,
                      ),
                  ],
                ),
              ],
              Text(
                l10n.collateralUsdcFee(
                  AppController.formatUsdc(market.collateralUsdc),
                  market.feeBps,
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
