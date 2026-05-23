import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/widgets/asset_card.dart';
import 'support.dart';

void main() {
  testWidgets('inventory lists assets and filters by every category', (tester) async {
    await pumpApp(tester);
    await openTab(tester, 'Inventory');
    expect(find.byType(AssetCard), findsNWidgets(4));

    for (final entry in {
      'Watches': 'Royal Oak',
      'Art': 'La Colombe',
      'Guitars': 'Les Paul Standard',
      'Glassware': 'Tumblers ×6',
    }.entries) {
      await tester.tap(find.text(entry.key));
      await tester.pumpAndSettle();
      expect(find.byType(AssetCard), findsOneWidget);
      expect(find.text(entry.value), findsOneWidget);
    }

    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();
    expect(find.byType(AssetCard), findsNWidgets(4));
  });
}
