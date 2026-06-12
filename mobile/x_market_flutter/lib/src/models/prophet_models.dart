class ProphecyPayload {
  const ProphecyPayload({
    required this.marketId,
    required this.predictedValue,
    required this.analysisContent,
  });

  final String marketId;
  final int predictedValue;
  final String analysisContent;
}

class ProphecyView {
  const ProphecyView({
    required this.id,
    required this.prophet,
    required this.marketId,
    required this.blobId,
    required this.sealIdHex,
    required this.plaintextHashHex,
    required this.predictedValue,
    required this.unlockPriceMist,
    required this.lockTime,
    required this.paidBuyers,
    required this.status,
    required this.isPublic,
    required this.unlockCount,
  });

  final String id;
  final String prophet;
  final String marketId;
  final String blobId;
  final String sealIdHex;
  final String plaintextHashHex;
  final int predictedValue;
  final int unlockPriceMist;
  final int lockTime;
  final List<String> paidBuyers;
  final int status;
  final bool isPublic;
  final int unlockCount;

  bool get isPublicProphecy => unlockPriceMist == 0 || isPublic;
}

class ProphetStatsView {
  const ProphetStatsView({
    required this.prophet,
    required this.wins,
    required this.losses,
    required this.cheats,
    required this.currentStreak,
    required this.maxStreak,
    required this.totalAudited,
    required this.totalUnlockRevenueMist,
    required this.scoreBps,
  });

  final String prophet;
  final int wins;
  final int losses;
  final int cheats;
  final int currentStreak;
  final int maxStreak;
  final int totalAudited;
  final int totalUnlockRevenueMist;
  final int scoreBps;
}

class LeaderboardEntry extends ProphetStatsView {
  const LeaderboardEntry({
    required super.prophet,
    required super.wins,
    required super.losses,
    required super.cheats,
    required super.currentStreak,
    required super.maxStreak,
    required super.totalAudited,
    required super.totalUnlockRevenueMist,
    required super.scoreBps,
    required this.rank,
    this.paidUnlockEligible = false,
  });

  final int rank;
  final bool paidUnlockEligible;

  factory LeaderboardEntry.fromIndexerJson(Map<String, dynamic> json) {
    int parseInt(dynamic value) {
      if (value is int) return value;
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    return LeaderboardEntry(
      prophet: json['prophet']?.toString() ?? '',
      wins: parseInt(json['wins']),
      losses: parseInt(json['losses']),
      cheats: parseInt(json['cheats']),
      currentStreak: parseInt(json['current_streak']),
      maxStreak: parseInt(json['max_streak']),
      totalAudited: parseInt(json['total_audited']),
      totalUnlockRevenueMist: parseInt(json['total_unlock_revenue']),
      scoreBps: parseInt(json['score_bps']),
      rank: parseInt(json['rank']),
      paidUnlockEligible: json['paid_unlock_eligible'] == true,
    );
  }
}

class DecryptedProphecyContent {
  const DecryptedProphecyContent({
    required this.json,
    required this.analysis,
    required this.payload,
  });

  final String json;
  final String analysis;
  final ProphecyPayload payload;
}

const int prophecyStatusOpen = 0;
const int minAuditedForPaid = 3;
const int minScoreBpsForPaid = 4000;
