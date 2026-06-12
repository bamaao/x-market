import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:x_market_flutter/src/sui_config.dart';

class WalrusService {
  WalrusService({HttpClient? client}) : _client = client ?? HttpClient();

  final HttpClient _client;

  static bool isWalrusBlobId(String blobId) {
    return blobId.isNotEmpty && !blobId.startsWith('testnet:local:');
  }

  Future<String> uploadBlob(Uint8List data, {int? epochs}) async {
    final e = epochs ?? SuiConfig.walrusEpochs;
    final uri = Uri.parse(
      '${SuiConfig.walrusPublisherUrl}/v1/blobs?epochs=$e&deletable=true',
    );
    final request = await _client.putUrl(uri);
    request.headers.contentType = ContentType.binary;
    request.add(data);
    final response = await request.close();
    final body = await utf8.decoder.bind(response).join();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Walrus 上传失败 (${response.statusCode}): ${body.substring(0, body.length.clamp(0, 200))}',
      );
    }
    final json = jsonDecode(body) as Map<String, dynamic>;
    final created = json['newlyCreated'] as Map<String, dynamic>?;
    final certified = json['alreadyCertified'] as Map<String, dynamic>?;
    final blobObject = created?['blobObject'] as Map<String, dynamic>?;
    final blobId =
        blobObject?['blobId']?.toString() ?? certified?['blobId']?.toString();
    if (blobId == null || blobId.isEmpty) {
      throw Exception('Walrus 响应缺少 blobId');
    }
    return blobId;
  }

  Future<Uint8List> readBlob(String blobId) async {
    final uri = Uri.parse(
      '${SuiConfig.walrusAggregatorUrl}/v1/blobs/${Uri.encodeComponent(blobId)}',
    );
    Exception? lastErr;
    for (var attempt = 0; attempt < 4; attempt++) {
      final request = await _client.getUrl(uri);
      final response = await request.close();
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final bytes = await response.fold<BytesBuilder>(
          BytesBuilder(),
          (builder, data) => builder..add(data),
        );
        return bytes.takeBytes();
      }
      lastErr = Exception('Walrus 读取失败 (${response.statusCode})');
      if (response.statusCode == 404 && attempt < 3) {
        await Future<void>.delayed(Duration(milliseconds: 1500 * (attempt + 1)));
        continue;
      }
      break;
    }
    throw lastErr ?? Exception('Walrus 读取失败');
  }
}
