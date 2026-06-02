import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/widgets/asset_card.dart';
import 'support.dart';

void main() {
  testWidgets('inventory lists the assets returned by the API', (tester) async {
    final session = mockSession(router: (req) {
      if (req.url.path == '/api/assets') {
        return [
          _asset('1', 'Royal Oak', 'Audemars Piguet', 4200000),
          _asset('2', 'La Colombe', 'Picasso', 9200000),
          _asset('3', 'Les Paul Standard', 'Gibson', 420000),
        ];
      }
      return null;
    });
    await pumpApp(tester, session);
    await openTab(tester, 'Inventory');

    expect(find.byType(AssetCard), findsNWidgets(3));
    expect(find.text('Royal Oak'), findsOneWidget);
    expect(find.text('Audemars Piguet'), findsOneWidget);
    expect(find.text('£42,000'), findsOneWidget); // 4,200,000 minor GBP
  });

  testWidgets('inventory shows the empty state when there are no assets',
      (tester) async {
    final session =
        mockSession(router: (req) => req.url.path == '/api/assets' ? [] : null);
    await pumpApp(tester, session);
    await openTab(tester, 'Inventory');
    expect(find.text('No assets in scope yet.'), findsOneWidget);
  });
}

Map<String, Object?> _asset(
        String id, String title, String maker, int costMinor) =>
    {
      'id': id,
      'title': title,
      'maker': maker,
      'categoryId': null,
      'trackingMode': 'unique',
      'quantity': 1,
      'ownershipStatus': 'owned',
      'acquisitionCostMinor': costMinor,
      'acquisitionCurrency': 'GBP',
      'attributes': <String, Object?>{},
    };
