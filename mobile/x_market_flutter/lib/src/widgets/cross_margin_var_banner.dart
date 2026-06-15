import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/app_controller.dart';
import 'package:x_market_flutter/src/l10n/l10n_ext.dart';

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
    final l10n = context.l10n;
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
              l10n.crossMarginVarTitle,
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
                      ? l10n.crossMarginVarWithPositions(positionCount!)
                      : l10n.crossMarginVarDefault),
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
