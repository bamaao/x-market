import 'dart:convert';
import 'dart:typed_data';

import 'package:sui/builder/transaction.dart';
import 'package:sui/sui_client.dart';
import 'package:sui/types/objects.dart';
import 'package:sui/types/transactions.dart';
import 'package:x_market_flutter/src/models/prophet_models.dart';
import 'package:x_market_flutter/src/l10n/app_exception.dart';
import 'package:x_market_flutter/src/prophet/prophecy_codec.dart';
import 'package:x_market_flutter/src/services/indexer_service.dart';
import 'package:x_market_flutter/src/services/prophet_blob_service.dart';
import 'package:x_market_flutter/src/sui_config.dart';
import 'package:x_market_flutter/src/trade/buy_transaction_service.dart';

class ProphetService {
  ProphetService({
    SuiClient? client,
    ChainTransactionService? tx,
    IndexerService? indexer,
    ProphetBlobService? blobs,
  }) : _client = client ?? SuiClient(SuiConfig.rpcUrl),
       _tx = tx ?? ChainTransactionService(),
       _indexer = indexer ?? IndexerService(),
       _blobs = blobs ?? ProphetBlobService();

  final SuiClient _client;
  final ChainTransactionService _tx;
  final IndexerService _indexer;
  final ProphetBlobService _blobs;

  String get registryId => SuiConfig.prophetRegistryId;

  Future<List<String>> discoverProphecyIds(String poolId) async {
    if (poolId.isEmpty) return const [];
    if (IndexerService.enabled) {
      final rows = await _indexer.fetchProphecies(poolId: poolId, limit: 100);
      final ids = rows.map((r) => r.prophecyId).where((id) => id.isNotEmpty).toList();
      if (ids.isNotEmpty) return ids;
    }
    return _lookupPropheciesByMarket(poolId);
  }

  Future<List<String>> _lookupPropheciesByMarket(String poolId) async {
    if (registryId.isEmpty) return const [];
    final tx = Transaction();
    tx.moveCall(
      '${SuiConfig.packageId}::prophet_registry::lookup_prophecies_by_market',
      arguments: [tx.object(registryId), tx.pure.id(poolId)],
    );
    try {
      final result = await _client.devInspectTransactionBlock(
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        tx,
      );
      if (result.error != null) return const [];
      final results = result.results;
      if (results == null || results.isEmpty) return const [];
      final rv = results.first.returnValues;
      if (rv is! List || rv.isEmpty) return const [];
      final first = rv.first;
      if (first is! List || first.isEmpty) return const [];
      final bytesRaw = first.first;
      if (bytesRaw is! List) return const [];
      return _parseIdVectorFromBcs(bytesRaw);
    } catch (_) {
      return const [];
    }
  }

  List<String> _parseIdVectorFromBcs(List<dynamic> bytes) {
    if (bytes.length < 2) return const [];
    final data = bytes.map((e) => (e as num).toInt()).toList();
    final len = (data[0] << 8) | data[1];
    final ids = <String>[];
    var offset = 2;
    for (var i = 0; i < len && offset + 32 <= data.length; i++) {
      final slice = data.sublist(offset, offset + 32);
      ids.add('0x${bytesToHex(slice)}');
      offset += 32;
    }
    return ids;
  }

  Future<ProphecyView?> fetchProphecy(String prophecyId) async {
    final resp = await _client.getObject(
      prophecyId,
      options: SuiObjectDataOptions(showContent: true),
    );
    final fields = _fieldsAsMap(getObjectFields(resp));
    if (fields == null) return null;
    return parseProphecyFields(prophecyId, fields);
  }

  Future<ProphetStatsView?> fetchProphetStats(String prophetAddress) async {
    if (registryId.isEmpty || prophetAddress.isEmpty) return null;
    try {
      final df = await _client.getDynamicFieldObject(
        registryId,
        'address',
        prophetAddress,
      );
      final fields = _fieldsAsMap(getObjectFields(df));
      if (fields == null) return null;
      return parseProphetStatsFields(fields);
    } catch (_) {
      return null;
    }
  }

  Future<List<LeaderboardEntry>> fetchLeaderboard({int limit = 50}) async {
    if (IndexerService.enabled) {
      final rows = await _indexer.fetchLeaderboard(limit: limit);
      if (rows.isNotEmpty) return rows;
    }
    return const [];
  }

  Future<DecryptedProphecyContent?> readPublicContent(ProphecyView prophecy) async {
    if (!prophecy.isPublicProphecy || !ProphetBlobService.isProphecyBlobId(prophecy.blobId)) {
      return null;
    }
    if (prophecy.sealIdHex.isNotEmpty) {
      return null;
    }

    if (IndexerService.enabled) {
      final cached = await _indexer.fetchCachedProphecyPlaintext(prophecy.id);
      if (cached != null) {
        return parseProphecyPlaintextJson(
          canonicalProphecyJson(
            ProphecyPayload(
              marketId: cached['market_id']?.toString() ?? prophecy.marketId,
              predictedValue:
                  int.tryParse(cached['predicted_value']?.toString() ?? '') ??
                  prophecy.predictedValue,
              analysisContent: cached['analysis_content']?.toString() ?? '',
            ),
          ),
        );
      }
    }

    try {
      final bytes = await _blobs.readBlob(prophecy.blobId);
      return parseProphecyPlaintextJson(utf8.decode(bytes));
    } catch (_) {
      return null;
    }
  }

  /// Indexer 明文上传 + 链上 commit（unlock_price=0，公开练手）。
  Future<PendingBuyTransaction> buildCommitPublicProphecy({
    required String sender,
    required String poolId,
    required int predictedValue,
    required String analysis,
    required int lockTime,
  }) async {
    if (registryId.isEmpty) {
      throw AppException(AppErrorCodes.prophetRegistryNotConfigured);
    }
    final payload = buildProphecyPayload(
      marketId: poolId,
      predictedValue: predictedValue,
      analysis: analysis.trim(),
    );
    final hash = hashProphecyPlaintext(payload);
    final json = canonicalProphecyJson(payload);
    final blobId = await _blobs.uploadBlob(
      poolId,
      Uint8List.fromList(utf8.encode(json)),
    );

    final tx = Transaction();
    tx.setSender(sender);
    tx.moveCall(
      '${SuiConfig.packageId}::prophet_registry::commit_private_prophecy',
      arguments: [
        tx.object(registryId),
        tx.object(poolId),
        tx.pure.vector('u8', utf8.encode(blobId)),
        tx.pure.vector('u8', const <int>[]),
        tx.pure.vector('u8', hash),
        tx.pure.u64(BigInt.from(predictedValue)),
        tx.pure.u64(BigInt.zero),
        tx.pure.u64(BigInt.from(lockTime)),
      ],
    );
    final kindBytes = await tx.build(
      BuildOptions(client: _client, onlyTransactionKind: true),
    );
    final bytes = await tx.build(BuildOptions(client: _client));
    return PendingBuyTransaction(
      txJson: tx.toJson(),
      txBytesBase64: base64Encode(bytes),
      transactionKindBase64: base64Encode(kindBytes),
      description: 'Commit public prediction',
    );
  }

  Map<String, dynamic>? _fieldsAsMap(dynamic fields) {
    if (fields == null) return null;
    if (fields is Map<String, dynamic>) return fields;
    if (fields is Map) return Map<String, dynamic>.from(fields);
    return null;
  }
}
