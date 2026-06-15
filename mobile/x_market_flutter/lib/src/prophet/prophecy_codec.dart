import 'dart:convert';
import 'dart:typed_data';

import 'package:pointycastle/digests/blake2b.dart';
import 'package:x_market_flutter/src/models/prophet_models.dart';

String canonicalProphecyJson(ProphecyPayload payload) {
  return jsonEncode({
    'market_id': payload.marketId,
    'predicted_value': payload.predictedValue,
    'analysis_content': payload.analysisContent,
  });
}

ProphecyPayload buildProphecyPayload({
  required String marketId,
  required int predictedValue,
  required String analysis,
}) {
  return ProphecyPayload(
    marketId: marketId,
    predictedValue: predictedValue,
    analysisContent: analysis,
  );
}

Uint8List hashProphecyPlaintext(ProphecyPayload payload) {
  final bytes = utf8.encode(canonicalProphecyJson(payload));
  final digest = Blake2bDigest(digestSize: 32);
  return digest.process(Uint8List.fromList(bytes));
}

String bytesToHex(List<int> bytes) {
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

DecryptedProphecyContent parseProphecyPlaintextJson(String json) {
  final parsed = jsonDecode(json) as Map<String, dynamic>;
  final payload = ProphecyPayload(
    marketId: parsed['market_id']?.toString() ?? '',
    predictedValue: int.tryParse(parsed['predicted_value']?.toString() ?? '') ?? 0,
    analysisContent: parsed['analysis_content']?.toString() ?? '',
  );
  return DecryptedProphecyContent(
    json: canonicalProphecyJson(payload),
    analysis: payload.analysisContent,
    payload: payload,
  );
}

ProphecyView parseProphecyFields(String id, Map<String, dynamic> fields) {
  return ProphecyView(
    id: id,
    prophet: fields['prophet']?.toString() ?? '',
    marketId: _parseObjectId(fields['market_id']),
    blobId: _decodeBytes(fields['blob_id']),
    sealIdHex: _decodeBytesToHex(fields['seal_id']),
    plaintextHashHex: _decodeBytesToHex(fields['plaintext_hash']),
    predictedValue: int.tryParse(fields['predicted_value']?.toString() ?? '') ?? 0,
    unlockPriceMist: int.tryParse(fields['unlock_price']?.toString() ?? '0') ?? 0,
    lockTime: int.tryParse(fields['lock_time']?.toString() ?? '0') ?? 0,
    paidBuyers: _parseAddressList(fields['paid_buyers']),
    status: int.tryParse(fields['status']?.toString() ?? '0') ?? 0,
    isPublic: fields['is_public'] == true,
    unlockCount: int.tryParse(fields['unlock_count']?.toString() ?? '0') ?? 0,
  );
}

ProphetStatsView parseProphetStatsFields(Map<String, dynamic> fields) {
  return ProphetStatsView(
    prophet: fields['prophet']?.toString() ?? '',
    wins: int.tryParse(fields['wins']?.toString() ?? '0') ?? 0,
    losses: int.tryParse(fields['losses']?.toString() ?? '0') ?? 0,
    cheats: int.tryParse(fields['cheats']?.toString() ?? '0') ?? 0,
    currentStreak: int.tryParse(fields['current_streak']?.toString() ?? '0') ?? 0,
    maxStreak: int.tryParse(fields['max_streak']?.toString() ?? '0') ?? 0,
    totalAudited: int.tryParse(fields['total_audited']?.toString() ?? '0') ?? 0,
    totalUnlockRevenueMist:
        int.tryParse(fields['total_unlock_revenue']?.toString() ?? '0') ?? 0,
    scoreBps: int.tryParse(fields['score_bps']?.toString() ?? '0') ?? 0,
  );
}

bool isPaidUnlockEligible(ProphetStatsView? stats) {
  if (stats == null) return false;
  return stats.cheats == 0 &&
      stats.totalAudited >= minAuditedForPaid &&
      stats.scoreBps >= minScoreBpsForPaid;
}

String paidUnlockEligibilityHint(ProphetStatsView? stats) {
  // Kept for tests; UI should use localizedPaidUnlockHint from l10n_helpers.dart.
  if (stats == null) {
    return 'New prophets must publish free predictions (unlock_price=0), complete ≥$minAuditedForPaid audits with Score ≥ ${minScoreBpsForPaid / 100} before paid unlock';
  }
  if (stats.cheats > 0) return 'Cheat record found; paid unlock unavailable';
  if (stats.totalAudited < minAuditedForPaid) {
    return 'Audited ${stats.totalAudited}/$minAuditedForPaid; keep publishing free predictions to build record';
  }
  if (stats.scoreBps < minScoreBpsForPaid) {
    return 'Prophet Score ${(stats.scoreBps / 100).toStringAsFixed(1)}, need ≥ ${minScoreBpsForPaid / 100} for paid unlock';
  }
  return 'Eligible for paid unlock (unlock_price > 0). Use Web App for Seal encrypted predictions on Mobile';
}

String prophecyStatusLabel(int status) {
  // Kept for tests; UI should use localizedProphecyStatus from l10n_helpers.dart.
  switch (status) {
    case prophecyStatusOpen:
      return 'Open';
    case 1:
      return 'Audited · Win';
    case 2:
      return 'Audited · Loss';
    case 3:
      return 'Cheat';
    default:
      return 'Unknown($status)';
  }
}

String _parseObjectId(dynamic value) {
  if (value is String) return value;
  if (value is Map && value['id'] != null) return value['id'].toString();
  return '';
}

String _decodeBytes(dynamic value) {
  if (value is String) {
    try {
      return utf8.decode(base64Decode(value));
    } catch (_) {
      return value;
    }
  }
  if (value is List) {
    return utf8.decode(value.cast<int>());
  }
  return '';
}

String _decodeBytesToHex(dynamic value) {
  if (value is List) {
    return bytesToHex(value.cast<int>());
  }
  final text = _decodeBytes(value);
  if (text.isEmpty) return '';
  return bytesToHex(utf8.encode(text));
}

List<String> _parseAddressList(dynamic value) {
  if (value is! List) return const [];
  return value.map((e) => e.toString()).toList();
}
