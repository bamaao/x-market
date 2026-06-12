import 'package:flutter_test/flutter_test.dart';
import 'package:x_market_flutter/src/models/pricing_models.dart';
import 'package:x_market_flutter/src/services/gas_station_service.dart';
import 'package:x_market_flutter/src/services/pricing_service.dart';
import 'package:x_market_flutter/src/trade/buy_transaction_service.dart';

void main() {
  test('QuotePreview.fromJson parses payout and roi', () {
    final quote = QuotePreview.fromJson({
      'entryProbPercent': 42.5,
      'payoutUsdc': '1425000',
      'impliedRoiBps': 4250,
    });
    expect(quote.entryProbPercent, 42.5);
    expect(quote.payoutUsdcMist, 1425000);
    expect(quote.impliedRoiBps, 4250);
  });

  test('supportsMarketKind excludes beta', () {
    expect(PricingService.supportsMarketKind('poisson'), isTrue);
    expect(PricingService.supportsMarketKind('beta'), isFalse);
  });

  test('PendingBuyTransaction.withSponsor replaces bytes and signatures', () {
    const pending = PendingBuyTransaction(
      txJson: '{}',
      txBytesBase64: 'old',
      description: 'buy',
      transactionKindBase64: 'kind',
    );
    const sponsor = SponsorResponse(
      transactionBytes: 'new-bytes',
      sponsorSignature: 'sig-sponsor',
      gasOwner: '0xgas',
    );
    final next = pending.withSponsor(sponsor);
    expect(next.txBytesBase64, 'new-bytes');
    expect(next.sponsorSignature, 'sig-sponsor');
    expect(next.isSponsored, isTrue);
  });
}
