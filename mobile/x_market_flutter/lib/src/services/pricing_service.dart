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

import 'package:x_market_flutter/src/models/pricing_models.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/sui_config.dart';
import 'package:x_market_flutter/src/trade/buy_transaction_service.dart';

class PricingService {
  PricingService({HttpClient? client}) : _client = client ?? HttpClient();

  final HttpClient _client;

  static bool get enabled {
    final url = SuiConfig.pricingEngineUrl.trim();
    return url.isNotEmpty;
  }

  static String get baseUrl =>
      SuiConfig.pricingEngineUrl.replaceAll(RegExp(r'/$'), '');

  /// Pricing Engine 当前支持 poisson / dirichlet / normal（与 Web TradePanel 一致）。
  static bool supportsMarketKind(String kind) {
    return kind == 'poisson' || kind == 'dirichlet' || kind == 'normal';
  }

  Future<QuotePreview?> fetchQuotePreview({
    required MarketPoolSnapshot market,
    required BuyParams params,
    required int stakeUsdcMist,
  }) async {
    if (!enabled || !supportsMarketKind(market.kind)) {
      return null;
    }
    final query = _buildQuery(market: market, params: params, stakeUsdcMist: stakeUsdcMist);
    if (query == null) return null;

    try {
      final uri = Uri.parse('$baseUrl/v1/quote?$query');
      final request = await _client.getUrl(uri);
      final response = await request.close();
      final body = await utf8.decoder.bind(response).join();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }
      final parsed = jsonDecode(body);
      if (parsed is! Map<String, dynamic>) return null;
      final quote = parsed['quote'];
      if (quote is! Map<String, dynamic>) return null;
      return QuotePreview.fromJson(quote);
    } catch (_) {
      return null;
    }
  }

  String? _buildQuery({
    required MarketPoolSnapshot market,
    required BuyParams params,
    required int stakeUsdcMist,
  }) {
    final q = <String, String>{
      'kind': market.kind,
      'stake_usdc': '$stakeUsdcMist',
    };

    switch (market.kind) {
      case 'poisson':
        q['lambda_tenths'] = '${market.lambdaTenths ?? 25}';
        q['poisson_a'] = '${params.poissonA}';
        q['poisson_b'] = '${params.poissonB}';
        q['poisson_k'] = '${params.poissonK}';
        q['mode'] = params.mode == ContractMode.digital ? 'digital' : 'interval';
      case 'dirichlet':
        q['alphas'] = '10,10,10';
        q['outcome'] = '${params.dirichletOutcome}';
      case 'normal':
        q['mu_tenths'] = '${market.muTenths ?? 25}';
        q['sigma_tenths'] = '${market.sigmaTenths ?? 4}';
        q['threshold_tenths'] = '${params.normalThreshold}';
        q['mode'] = 'interval';
      default:
        return null;
    }
    return q.entries
        .map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
  }
}
