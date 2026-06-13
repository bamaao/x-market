import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

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
      throw Exception('Indexer 未配置');
    }
    if (poolId.isEmpty) {
      throw Exception('pool_id 为空');
    }
    if (data.isEmpty) {
      throw Exception('空 blob');
    }
    if (data.length > 512 * 1024) {
      throw Exception('blob 超过 512KB');
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
      throw Exception('Indexer 上传失败 (${response.statusCode}): $body');
    }
    final parsed = jsonDecode(body);
    if (parsed is! Map<String, dynamic>) {
      throw Exception('Indexer 响应无效');
    }
    final blobId = parsed['blob_id']?.toString().trim() ?? '';
    if (blobId.isEmpty) {
      throw Exception('Indexer 响应缺少 blob_id');
    }
    return blobId;
  }

  Future<Uint8List> readBlob(String blobId) async {
    if (blobId.startsWith('idx:')) {
      if (!IndexerService.enabled) {
        throw Exception('Indexer 未配置');
      }
      final filename = blobId.substring(4);
      final uri = Uri.parse(
        '${IndexerService.baseUrl}/v1/prophecies/blobs/${Uri.encodeComponent(filename)}',
      );
      final request = await _client.getUrl(uri);
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Indexer blob 读取失败 (${response.statusCode})');
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
        throw Exception('IPFS 读取失败 (${response.statusCode})');
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

    throw Exception('不支持的 blob_id（需 idx: 或 ipfs:）');
  }
}
