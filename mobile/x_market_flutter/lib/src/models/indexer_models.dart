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

class IndexerMarket {
  IndexerMarket({
    required this.poolId,
    required this.title,
    required this.description,
    required this.kind,
    this.slug,
    this.imageUrl,
    this.tags = const [],
    this.feeBps = 0,
    this.maturityTs,
    this.paused = false,
    this.resolved = false,
    this.lambdaTenths,
    this.muTenths,
    this.sigmaTenths,
  });

  final String poolId;
  final String? slug;
  final String title;
  final String description;
  final String kind;
  final String? imageUrl;
  final List<String> tags;
  final int feeBps;
  final String? maturityTs;
  final bool paused;
  final bool resolved;
  final int? lambdaTenths;
  final int? muTenths;
  final int? sigmaTenths;

  factory IndexerMarket.fromJson(Map<String, dynamic> json) {
    return IndexerMarket(
      poolId: _str(json['pool_id']),
      slug: _nullableStr(json['slug']),
      title: _str(json['title']),
      description: _str(json['description']),
      kind: _str(json['kind']),
      imageUrl: _nullableStr(json['image_url']),
      tags: _strList(json['tags']),
      feeBps: _int(json['fee_bps']),
      maturityTs: _nullableStr(json['maturity_ts']),
      paused: json['paused'] == true,
      resolved: json['resolved'] == true,
      lambdaTenths: _nullableInt(json['lambda_tenths']),
      muTenths: _nullableInt(json['mu_tenths']),
      sigmaTenths: _nullableInt(json['sigma_tenths']),
    );
  }
}

class MarketRef {
  const MarketRef({
    required this.id,
    required this.title,
    required this.description,
    required this.kind,
    required this.poolId,
    this.imageUrl,
    this.tags = const [],
  });

  final String id;
  final String title;
  final String description;
  final String kind;
  final String poolId;
  final String? imageUrl;
  final List<String> tags;
}

class IndexerProphecyRow {
  IndexerProphecyRow({
    required this.prophecyId,
    required this.poolId,
    required this.prophet,
    required this.predictedValue,
    required this.unlockPriceMist,
    required this.isPublic,
    required this.status,
  });

  final String prophecyId;
  final String poolId;
  final String prophet;
  final int predictedValue;
  final int unlockPriceMist;
  final bool isPublic;
  final int status;

  factory IndexerProphecyRow.fromJson(Map<String, dynamic> json) {
    return IndexerProphecyRow(
      prophecyId: _str(json['prophecy_id'] ?? json['prophecyId']),
      poolId: _str(json['pool_id']),
      prophet: _str(json['prophet']),
      predictedValue: _int(json['predicted_value']),
      unlockPriceMist: _int(json['unlock_price']),
      isPublic: json['is_public'] == true,
      status: _int(json['status']),
    );
  }
}

String _str(dynamic value) => value?.toString() ?? '';

String? _nullableStr(dynamic value) {
  final s = value?.toString();
  if (s == null || s.isEmpty) return null;
  return s;
}

int _int(dynamic value) {
  if (value is int) return value;
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

int? _nullableInt(dynamic value) {
  if (value == null) return null;
  return _int(value);
}

List<String> _strList(dynamic value) {
  if (value is! List) return const [];
  return value.map((e) => e.toString()).toList();
}
