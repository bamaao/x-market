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

class QuotePreview {
  const QuotePreview({
    required this.entryProbPercent,
    required this.payoutUsdcMist,
    required this.impliedRoiBps,
  });

  final double entryProbPercent;
  final int payoutUsdcMist;
  final int impliedRoiBps;

  factory QuotePreview.fromJson(Map<String, dynamic> json) {
    return QuotePreview(
      entryProbPercent: (json['entryProbPercent'] as num?)?.toDouble() ?? 0,
      payoutUsdcMist: int.tryParse(json['payoutUsdc']?.toString() ?? '') ?? 0,
      impliedRoiBps: (json['impliedRoiBps'] as num?)?.toInt() ?? 0,
    );
  }
}
