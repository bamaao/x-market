import 'dart:convert';
import 'dart:io';

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
      throw Exception('Gas Station 未配置');
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
      throw Exception(error ?? 'Gas Station HTTP ${response.statusCode}');
    }
    if (parsed is! Map<String, dynamic>) {
      throw Exception('Gas Station 响应格式异常');
    }
    return SponsorResponse.fromJson(parsed);
  }
}
