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
import 'dart:typed_data';

import 'package:x_market_flutter/src/l10n/app_exception.dart';
import 'package:x_market_flutter/src/services/indexer_service.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class ProphetBlobService {
  ProphetBlobService({HttpClient? client}) : _client = client ?? HttpClient();

  final HttpClient _client;

  static bool isProphecyBlobId(String blobId) {
    if (blobId.isEmpty || blobId.startsWith('testnet:local:')) return false;
    if (blobId.startsWith('idx:')) {
      final name = blobId.substring(4);
      return RegExp(r'^[a-f0-9-]+\.bin$', caseSensitive: false).hasMatch(name);
    }
    return _parseIpfsCid(blobId) != null;
  }

  static String? _parseIpfsCid(String ref) {
    final trimmed = ref.trim();
    if (trimmed.startsWith('ipfs://')) {
      return trimmed.substring(7).split('/').first.trim();
    }
    if (trimmed.startsWith('ipfs:')) {
      return trimmed.substring(5).split('/').first.trim();
    }
    return null;
  }

  Future<String> uploadBlob(String poolId, Uint8List data) async {
    if (!IndexerService.enabled) {
      throw AppException(AppErrorCodes.indexerNotConfigured);
    }
    if (poolId.isEmpty) {
      throw AppException(AppErrorCodes.emptyPoolId);
    }
    if (data.isEmpty) {
      throw AppException(AppErrorCodes.emptyBlob);
    }
    if (data.length > 512 * 1024) {
      throw AppException(AppErrorCodes.blobTooLarge);
    }

    final uri = Uri.parse(
      '${IndexerService.baseUrl}/v1/prophecies/blob?pool_id=${Uri.encodeQueryComponent(poolId)}',
    );
    final request = await _client.postUrl(uri);
    request.headers.set('Content-Type', 'application/octet-stream');
    request.add(data);
    final response = await request.close();
    final body = await utf8.decoder.bind(response).join();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AppException(
        AppErrorCodes.indexerUploadFailed,
        args: {'status': response.statusCode, 'body': body},
      );
    }
    final parsed = jsonDecode(body);
    if (parsed is! Map<String, dynamic>) {
      throw AppException(AppErrorCodes.invalidIndexerResponse);
    }
    final blobId = parsed['blob_id']?.toString().trim() ?? '';
    if (blobId.isEmpty) {
      throw AppException(AppErrorCodes.missingBlobId);
    }
    return blobId;
  }

  Future<Uint8List> readBlob(String blobId) async {
    if (blobId.startsWith('idx:')) {
      if (!IndexerService.enabled) {
        throw AppException(AppErrorCodes.indexerNotConfigured);
      }
      final filename = blobId.substring(4);
      final uri = Uri.parse(
        '${IndexerService.baseUrl}/v1/prophecies/blobs/${Uri.encodeComponent(filename)}',
      );
      final request = await _client.getUrl(uri);
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AppException(
          AppErrorCodes.indexerBlobReadFailed,
          args: {'status': response.statusCode},
        );
      }
      final bytes = await response.fold<BytesBuilder>(
        BytesBuilder(copy: false),
        (b, data) {
          b.add(data);
          return b;
        },
      );
      return bytes.takeBytes();
    }

    final cid = _parseIpfsCid(blobId);
    if (cid != null) {
      final gateway = SuiConfig.ipfsGatewayUrl.replaceAll(RegExp(r'/$'), '');
      final uri = Uri.parse('$gateway/ipfs/${Uri.encodeComponent(cid)}');
      final request = await _client.getUrl(uri);
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AppException(
          AppErrorCodes.ipfsReadFailed,
          args: {'status': response.statusCode},
        );
      }
      final bytes = await response.fold<BytesBuilder>(
        BytesBuilder(copy: false),
        (b, data) {
          b.add(data);
          return b;
        },
      );
      return bytes.takeBytes();
    }

    throw AppException(AppErrorCodes.unsupportedBlobId);
  }
}
