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

import 'package:x_market_flutter/src/models/indexer_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/services/sui_rpc_service.dart';
import 'package:x_market_flutter/src/utils/move_object_fields.dart';

class MarketCatalogResult {
  const MarketCatalogResult({
    required this.markets,
    required this.refsByPoolId,
    required this.usedIndexer,
  });

  final List<MarketPoolSnapshot> markets;
  final Map<String, MarketRef> refsByPoolId;
  final bool usedIndexer;
}

class MarketCatalog {
  static MarketRef seedToRef(MarketPoolSnapshot market) {
    return MarketRef(
      id: market.slug ?? market.poolId,
      title: market.label,
      description: market.description ?? '',
      kind: market.kind,
      poolId: market.poolId,
      tags: market.tags,
    );
  }

  static MarketRef indexerToRef(IndexerMarket row) {
    return MarketRef(
      id: row.slug ?? row.poolId,
      title: row.title,
      description: row.description,
      kind: row.kind,
      poolId: row.poolId,
      imageUrl: row.imageUrl,
      tags: row.tags,
    );
  }

  static MarketPoolSnapshot enrichFromIndexer({
    required MarketPoolSnapshot base,
    required IndexerMarket row,
  }) {
    return MarketPoolSnapshot(
      poolId: base.poolId,
      label: row.title.isNotEmpty ? row.title : base.label,
      kind: base.kind.isNotEmpty ? base.kind : row.kind,
      status: base.status,
      collateralUsdc: base.collateralUsdc,
      feeBps: base.feeBps,
      maturityTs: base.maturityTs,
      paused: base.paused,
      lambdaTenths: base.lambdaTenths ?? row.lambdaTenths,
      muTenths: base.muTenths ?? row.muTenths,
      sigmaTenths: base.sigmaTenths ?? row.sigmaTenths,
      dirichletLen: base.dirichletLen,
      description: row.description,
      slug: row.slug,
      tags: row.tags,
    );
  }

  /// Merge configured seed pools (RPC truth) with Indexer metadata.
  /// Indexer-only pools are appended after seeds.
  static Future<MarketCatalogResult> merge({
    required List<MarketPoolSnapshot> seeds,
    required List<IndexerMarket> indexerRows,
    required SuiRpcService rpc,
  }) async {
    final snapshots = <String, MarketPoolSnapshot>{
      for (final s in seeds) s.poolId: s,
    };
    final refs = <String, MarketRef>{
      for (final s in seeds) s.poolId: seedToRef(s),
    };
    var usedIndexer = false;

    for (final row in indexerRows) {
      final existing = snapshots[row.poolId];
      if (existing != null) {
        snapshots[row.poolId] = enrichFromIndexer(base: existing, row: row);
        refs[row.poolId] = indexerToRef(row);
        usedIndexer = true;
        continue;
      }

      try {
        final chain = await rpc.fetchMarketPool(
          poolId: row.poolId,
          label: row.title,
          kind: row.kind,
        );
        snapshots[row.poolId] = enrichFromIndexer(base: chain, row: row);
        refs[row.poolId] = indexerToRef(row);
        usedIndexer = true;
      } catch (_) {
        // Skip pools that no longer exist on chain.
      }
    }

    final seedOrder = seeds.map((s) => s.poolId).toList();
    final merged = <MarketPoolSnapshot>[
      for (final poolId in seedOrder)
        if (snapshots.containsKey(poolId)) snapshots[poolId]!,
    ];
    for (final entry in snapshots.entries) {
      if (!seedOrder.contains(entry.key)) {
        merged.add(entry.value);
      }
    }

    return MarketCatalogResult(
      markets: merged,
      refsByPoolId: refs,
      usedIndexer: usedIndexer,
    );
  }

  static MarketRef? findRefByPoolId(
    String? poolId,
    Map<String, MarketRef> refsByPoolId,
  ) {
    if (poolId == null || poolId.isEmpty) return null;
    for (final entry in refsByPoolId.entries) {
      if (poolIdsMatch(entry.key, poolId)) {
        return entry.value;
      }
    }
    return null;
  }
}
