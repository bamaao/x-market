/// Parse Move `ID` fields from Sui RPC JSON (`"0x…"` or `{"id":"0x…"}`).
String? parseMoveObjectId(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is String) {
    final s = value.trim();
    return s.isEmpty ? null : s;
  }
  if (value is Map) {
    final id = value['id'];
    if (id is String) {
      final s = id.trim();
      return s.isEmpty ? null : s;
    }
  }
  return null;
}

int parseLinkedPositionCount(Map<String, dynamic> fields) {
  final linked = fields['linked_positions'];
  if (linked is List) {
    return linked.length;
  }
  return 0;
}

bool poolIdsMatch(String? a, String? b) {
  if (a == null || b == null) {
    return false;
  }
  return a.trim().toLowerCase() == b.trim().toLowerCase();
}

int parseMoveInt(dynamic value) {
  if (value is int) {
    return value;
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

int parseWorstLiabilityMist(Map<String, dynamic> fields) {
  final slots = fields['liability_by_slot'];
  if (slots is! List) {
    return 0;
  }
  var worst = 0;
  for (final slot in slots) {
    final value = parseMoveInt(slot);
    if (value > worst) {
      worst = value;
    }
  }
  return worst;
}
