import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';

class CrossMarginVarBanner extends StatelessWidget {
  const CrossMarginVarBanner({
    super.key,
    required this.varMist,
    this.positionCount,
    this.subtitle,
  });

  final int varMist;
  final int? positionCount;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.45),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Cross-Margin VaR（估算）',
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: 4),
            Text(
              '${AppController.formatUsdc(varMist)} USDC',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle ??
                  (positionCount != null
                      ? '基于 $positionCount 个持仓，15 个 outcome slot 最坏情景聚合'
                      : '基于 15 个 outcome slot 最坏情景聚合'),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
