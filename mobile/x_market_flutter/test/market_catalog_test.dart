import 'package:flutter_test/flutter_test.dart';
import 'package:x_market_flutter/src/models/indexer_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/services/market_catalog.dart';
import 'package:x_market_flutter/src/services/sui_rpc_service.dart';

MarketPoolSnapshot _seed({
  required String poolId,
  String label = 'Seed',
}) {
  return MarketPoolSnapshot(
    poolId: poolId,
    label: label,
    kind: 'poisson',
    status: 1,
    collateralUsdc: 1_000_000,
    feeBps: 30,
    maturityTs: 1_700_000_000,
    paused: false,
  );
}

void main() {
  test('IndexerMarket.fromJson parses tags and pool_id', () {
    final row = IndexerMarket.fromJson({
      'pool_id': '0xabc',
      'slug': 'poisson-goals',
      'title': '足球总进球',
      'description': 'desc',
      'kind': 'poisson',
      'fee_bps': 30,
      'tags': ['football', 'sports'],
    });

    expect(row.poolId, '0xabc');
    expect(row.slug, 'poisson-goals');
    expect(row.tags, ['football', 'sports']);
  });

  test('enrichFromIndexer keeps chain state and applies metadata', () {
    final base = _seed(poolId: '0xabc', label: 'Old label');
    final row = IndexerMarket(
      poolId: '0xabc',
      slug: 'poisson-goals',
      title: '足球总进球 · Poisson',
      description: 'Indexer 描述',
      kind: 'poisson',
      tags: ['football'],
    );

    final enriched = MarketCatalog.enrichFromIndexer(base: base, row: row);

    expect(enriched.label, '足球总进球 · Poisson');
    expect(enriched.description, 'Indexer 描述');
    expect(enriched.collateralUsdc, 1_000_000);
    expect(enriched.tags, ['football']);
  });

  test('merge enriches seeds and skips missing indexer-only pools', () async {
    final seeds = [
      _seed(poolId: '0xseed1', label: 'Seed One'),
    ];
    final rows = [
      IndexerMarket(
        poolId: '0xseed1',
        title: 'Indexer One',
        description: 'from indexer',
        kind: 'poisson',
      ),
      IndexerMarket(
        poolId: '0xdeadbeef',
        title: 'Missing Pool',
        description: 'gone',
        kind: 'normal',
      ),
    ];

    final rpc = _FailingExtraPoolRpc();
    final result = await MarketCatalog.merge(
      seeds: seeds,
      indexerRows: rows,
      rpc: rpc,
    );

    expect(result.markets.length, 1);
    expect(result.markets.first.label, 'Indexer One');
    expect(result.usedIndexer, isTrue);
    expect(result.refsByPoolId['0xseed1']?.title, 'Indexer One');
  });

  test('findRefByPoolId matches case-insensitively', () {
    final refs = {
      '0xAbC': const MarketRef(
        id: 'poisson-goals',
        title: 'Poisson',
        description: '',
        kind: 'poisson',
        poolId: '0xAbC',
      ),
    };

    final hit = MarketCatalog.findRefByPoolId('0xabc', refs);
    expect(hit?.title, 'Poisson');
  });
}

class _FailingExtraPoolRpc extends SuiRpcService {
  @override
  Future<MarketPoolSnapshot> fetchMarketPool({
    required String poolId,
    required String label,
    required String kind,
  }) {
    throw Exception('pool missing');
  }
}
