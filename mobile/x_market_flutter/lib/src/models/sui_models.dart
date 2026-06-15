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
