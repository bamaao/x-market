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

import 'dart:convert';
import 'dart:io';

import 'package:x_market_flutter/src/models/indexer_models.dart';
import 'package:x_market_flutter/src/models/prophet_models.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class IndexerService {
  IndexerService({HttpClient? client}) : _client = client ?? HttpClient();

  final HttpClient _client;

  static bool get enabled {
    final url = SuiConfig.indexerUrl.trim();
    return url.isNotEmpty;
  }

  static String get baseUrl => SuiConfig.indexerUrl.replaceAll(RegExp(r'/$'), '');

  Future<bool> checkHealth() async {
    if (!enabled) return false;
    try {
      final data = await _getJson('/health');
      return data?['ok'] == true;
    } catch (_) {
      return false;
    }
  }

  Future<List<IndexerMarket>> fetchMarkets({
    String? tag,
    String? kind,
    String? query,
  }) async {
    if (!enabled) return const [];
    final params = <String, String>{};
    if (tag != null && tag.isNotEmpty) params['tag'] = tag;
    if (kind != null && kind.isNotEmpty) params['kind'] = kind;
    if (query != null && query.isNotEmpty) params['q'] = query;
    final qs = params.entries
        .map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    final path = qs.isEmpty ? '/v1/markets' : '/v1/markets?$qs';
    final data = await _getJson(path);
    final rows = data?['markets'];
    if (rows is! List) return const [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(IndexerMarket.fromJson)
        .toList();
  }

  Future<IndexerMarket?> fetchMarket(String poolId) async {
    if (!enabled || poolId.isEmpty) return null;
    final data = await _getJson('/v1/markets/${Uri.encodeComponent(poolId)}');
    final row = data?['market'];
    if (row is! Map<String, dynamic>) return null;
    return IndexerMarket.fromJson(row);
  }

  Future<List<IndexerProphecyRow>> fetchProphecies({
    String? poolId,
    String? prophet,
    int limit = 100,
  }) async {
    if (!enabled) return const [];
    final params = <String, String>{'limit': '$limit'};
    if (poolId != null && poolId.isNotEmpty) params['pool_id'] = poolId;
    if (prophet != null && prophet.isNotEmpty) params['prophet'] = prophet;
    final qs = params.entries
        .map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    final data = await _getJson('/v1/prophecies?$qs');
    final rows = data?['prophecies'];
    if (rows is! List) return const [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(IndexerProphecyRow.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>?> fetchCachedProphecyPlaintext(
    String prophecyId,
  ) async {
    if (!enabled || prophecyId.isEmpty) return null;
    final data = await _getJson(
      '/v1/prophecies/${Uri.encodeComponent(prophecyId)}/plaintext',
    );
    final cache = data?['cache'];
    if (cache is! Map<String, dynamic>) return null;
    final plaintext = cache['plaintext_json'];
    if (plaintext is! Map<String, dynamic>) return null;
    return plaintext;
  }

  Future<List<LeaderboardEntry>> fetchLeaderboard({int limit = 50}) async {
    if (!enabled) return const [];
    final data = await _getJson('/v1/prophet/leaderboard?limit=$limit');
    final rows = data?['leaderboard'];
    if (rows is! List) return const [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(LeaderboardEntry.fromIndexerJson)
        .toList();
  }

  Future<Map<String, dynamic>?> _getJson(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = await _client.getUrl(uri);
    final response = await request.close();
    final body = await utf8.decoder.bind(response).join();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return null;
    }
    final parsed = jsonDecode(body);
    if (parsed is Map<String, dynamic>) return parsed;
    return null;
  }
}
