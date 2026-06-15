import 'dart:convert';
import 'dart:io';

import 'package:x_market_flutter/src/l10n/app_exception.dart';
import 'package:x_market_flutter/src/models/sui_models.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class SuiRpcService {
  final HttpClient _client = HttpClient();

  Future<List<MarketPoolSnapshot>> fetchSeedMarkets() async {
    final result = <MarketPoolSnapshot>[];
    for (final seed in SuiConfig.seedPools) {
      result.add(
        await fetchMarketPool(
          poolId: seed.id,
          label: seed.label,
          kind: seed.kind,
        ),
      );
    }
    return result;
  }

  Future<MarketPoolSnapshot> fetchMarketPool({
    required String poolId,
    required String label,
    required String kind,
  }) async {
    final payload = {
      'jsonrpc': '2.0',
      'id': 1,
      'method': 'sui_getObject',
      'params': [
        poolId,
        {'showContent': true},
      ],
    };
    final body = await _post(payload);
    final root = _jsonMap(body);
    final result = _readMap(root, 'result');
    final data = _readMap(result, 'data');
    final content = _readMap(data, 'content');
    final fields = _readMap(content, 'fields');

    return MarketPoolSnapshot(
      poolId: poolId,
      label: label,
      kind: kind,
      status: _asInt(fields['status']),
      collateralUsdc: _asInt(fields['collateral_usdc']),
      feeBps: _asInt(fields['fee_bps']),
      maturityTs: _asInt(fields['maturity_ts']),
      paused: _asBool(fields['paused']),
      lambdaTenths: _asNullableInt(fields['lambda_tenths']),
      muTenths: _asNullableInt(fields['mu_tenths']),
      sigmaTenths: _asNullableInt(fields['sigma_tenths']),
      dirichletLen: _asNullableInt(fields['dirichlet_len']),
    );
  }

  Future<WalletSummary> fetchWalletSummary({required String address}) async {
    final normalized = normalizeAddress(address);
    final payload = {
      'jsonrpc': '2.0',
      'id': 1,
      'method': 'suix_getBalance',
      'params': [normalized, SuiConfig.usdcCoinType],
    };
    final body = await _post(payload);
    final root = _jsonMap(body);
    final result = _readMap(root, 'result');

    return WalletSummary(
      address: normalized,
      totalUsdcMist: _asInt(result['totalBalance']),
    );
  }

  bool isValidAddress(String input) {
    final v = input.trim().toLowerCase();
    if (!v.startsWith('0x')) {
      return false;
    }
    final hex = v.substring(2);
    if (hex.isEmpty || hex.length > 64) {
      return false;
    }
    final hexRegex = RegExp(r'^[0-9a-f]+$');
    return hexRegex.hasMatch(hex);
  }

  String normalizeAddress(String input) {
    final v = input.trim().toLowerCase();
    if (!isValidAddress(v)) {
      throw AppException(AppErrorCodes.invalidAddress);
    }
    final hex = v.substring(2).padLeft(64, '0');
    return '0x$hex';
  }

  Future<String> _post(Map<String, dynamic> payload) async {
    final request = await _client.postUrl(Uri.parse(SuiConfig.rpcUrl));
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode(payload));
    final response = await request.close();
    final body = await utf8.decoder.bind(response).join();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AppException(
        AppErrorCodes.rpcHttpFailed,
        args: {'status': response.statusCode},
      );
    }
    final root = _jsonMap(body);
    if (root.containsKey('error')) {
      throw AppException(
        AppErrorCodes.rpcError,
        args: {'error': '${root['error']}'},
      );
    }
    return body;
  }

  Map<String, dynamic> _jsonMap(String body) {
    final parsed = jsonDecode(body);
    if (parsed is! Map<String, dynamic>) {
      throw AppException(AppErrorCodes.rpcInvalidResponse);
    }
    return parsed;
  }

  Map<String, dynamic> _readMap(Map<String, dynamic> src, String key) {
    final value = src[key];
    if (value is! Map<String, dynamic>) {
      throw AppException(
        AppErrorCodes.rpcMissingField,
        args: {'field': key},
      );
    }
    return value;
  }

  int _asInt(dynamic value) {
    if (value is int) {
      return value;
    }
    if (value is String) {
      return int.tryParse(value) ?? 0;
    }
    return 0;
  }

  int? _asNullableInt(dynamic value) {
    if (value == null) {
      return null;
    }
    return _asInt(value);
  }

  bool _asBool(dynamic value) {
    if (value is bool) {
      return value;
    }
    if (value is String) {
      return value.toLowerCase() == 'true';
    }
    return false;
  }
}
