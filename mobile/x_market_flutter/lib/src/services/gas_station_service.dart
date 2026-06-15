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

import 'package:x_market_flutter/src/l10n/app_exception.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class SponsorResponse {
  const SponsorResponse({
    required this.transactionBytes,
    required this.sponsorSignature,
    required this.gasOwner,
  });

  final String transactionBytes;
  final String sponsorSignature;
  final String gasOwner;

  factory SponsorResponse.fromJson(Map<String, dynamic> json) {
    return SponsorResponse(
      transactionBytes: json['transactionBytes']?.toString() ?? '',
      sponsorSignature: json['sponsorSignature']?.toString() ?? '',
      gasOwner: json['gasOwner']?.toString() ?? '',
    );
  }
}

class GasStationService {
  GasStationService({HttpClient? client}) : _client = client ?? HttpClient();

  final HttpClient _client;

  static bool get enabled {
    final url = SuiConfig.gasStationUrl.trim();
    return url.isNotEmpty;
  }

  static String get baseUrl =>
      SuiConfig.gasStationUrl.replaceAll(RegExp(r'/$'), '');

  Future<bool> checkHealth() async {
    if (!enabled) return false;
    try {
      final uri = Uri.parse('$baseUrl/health');
      final request = await _client.getUrl(uri);
      final response = await request.close();
      final body = await utf8.decoder.bind(response).join();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return false;
      }
      final parsed = jsonDecode(body);
      if (parsed is Map<String, dynamic>) {
        return parsed['ok'] == true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<SponsorResponse> requestSponsor({
    required String transactionKindBase64,
    required String sender,
  }) async {
    if (!enabled) {
      throw AppException(AppErrorCodes.gasStationNotConfigured);
    }
    final uri = Uri.parse('$baseUrl/v1/sponsor');
    final request = await _client.postUrl(uri);
    request.headers.contentType = ContentType.json;
    request.write(
      jsonEncode({
        'transactionKindBcs': transactionKindBase64,
        'sender': sender,
      }),
    );
    final response = await request.close();
    final body = await utf8.decoder.bind(response).join();
    final parsed = jsonDecode(body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = parsed is Map ? parsed['error']?.toString() : null;
      throw AppException(
        AppErrorCodes.gasStationHttpError,
        args: {'error': error ?? 'HTTP ${response.statusCode}'},
      );
    }
    if (parsed is! Map<String, dynamic>) {
      throw AppException(AppErrorCodes.gasStationInvalidResponse);
    }
    return SponsorResponse.fromJson(parsed);
  }
}
