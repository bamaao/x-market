class MarketPoolSnapshot {
  MarketPoolSnapshot({
    required this.poolId,
    required this.label,
    required this.kind,
    required this.status,
    required this.collateralUsdc,
    required this.feeBps,
    required this.maturityTs,
    required this.paused,
    this.lambdaTenths,
    this.muTenths,
    this.sigmaTenths,
    this.dirichletLen,
    this.description,
    this.slug,
    this.tags = const [],
  });

  final String poolId;
  final String label;
  final String kind;
  final int status;
  final int collateralUsdc;
  final int feeBps;
  final int maturityTs;
  final bool paused;
  final int? lambdaTenths;
  final int? muTenths;
  final int? sigmaTenths;
  final int? dirichletLen;
  final String? description;
  final String? slug;
  final List<String> tags;

  String get statusLabel {
    switch (status) {
      case 0:
        return 'Auction';
      case 1:
        return 'Trading';
      case 2:
        return 'Settled';
      default:
        return 'Unknown($status)';
    }
  }
}

class WalletSummary {
  WalletSummary({required this.address, required this.totalUsdcMist});

  final String address;
  final int totalUsdcMist;
}
