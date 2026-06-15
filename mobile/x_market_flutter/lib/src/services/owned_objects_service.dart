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

import 'package:sui/sui_client.dart';
import 'package:sui/types/objects.dart';
import 'package:x_market_flutter/src/models/owned_models.dart';
import 'package:x_market_flutter/src/sui_config.dart';

class OwnedObjectsService {
  OwnedObjectsService({String? rpcUrl})
    : _client = SuiClient(rpcUrl ?? SuiConfig.rpcUrl);

  final SuiClient _client;

  Future<List<PositionSnapshot>> fetchPositions(String owner) {
    return _fetchStructType(
      owner: owner,
      structType: '${SuiConfig.packageId}::position::Position',
      parse: (id, fields) => PositionSnapshot.fromFields(id, fields),
    );
  }

  Future<List<LpShareSnapshot>> fetchLpShares(String owner) {
    return _fetchStructType(
      owner: owner,
      structType: '${SuiConfig.packageId}::lp_token::LpShare',
      parse: (id, fields) => LpShareSnapshot.fromFields(id, fields),
    );
  }

  Future<List<MarginAccountSnapshot>> fetchMarginAccounts(String owner) {
    return _fetchStructType(
      owner: owner,
      structType: '${SuiConfig.packageId}::cross_margin::MarginAccount',
      parse: (id, fields) => MarginAccountSnapshot.fromFields(id, fields),
    );
  }

  Future<List<T>> _fetchStructType<T>({
    required String owner,
    required String structType,
    required T Function(String id, Map<String, dynamic> fields) parse,
  }) async {
    final out = <T>[];
    String? cursor;
    do {
      final page = await _client.getOwnedObjects(
        owner,
        options: SuiObjectDataOptions(showContent: true, showType: true),
        filter: {'StructType': structType},
        cursor: cursor,
      );
      for (final entry in page.data) {
        final data = entry.data;
        if (data == null || data.content == null) {
          continue;
        }
        final fields = data.content!.fields;
        if (fields is Map<String, dynamic>) {
          out.add(parse(data.objectId, fields));
        }
      }
      cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor != null);
    return out;
  }
}
