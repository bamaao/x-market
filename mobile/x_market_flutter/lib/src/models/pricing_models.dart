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
