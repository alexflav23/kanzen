import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

/// Full-app audit — the Flutter analogue of the web Playwright audit. Walks
/// every tab and every key interaction; after each step it asserts that the
/// framework recorded no exception (layout overflow, build error, failed
/// assertion all surface through takeException). The mobile equivalent of
/// "zero console errors".
void main() {
  testWidgets('every tab + interaction is clean (no exceptions/overflow)', (tester) async {
    await pumpApp(tester);
    expect(tester.takeException(), isNull, reason: 'boot');

    for (final tab in ['Home', 'Inventory', 'Properties', 'People', 'Money', 'Home']) {
      await openTab(tester, tab);
      expect(tester.takeException(), isNull, reason: 'open tab "$tab"');
    }

    // Inventory: every filter chip.
    await openTab(tester, 'Inventory');
    for (final c in ['Watches', 'Art', 'Guitars', 'Glassware', 'All']) {
      await tester.tap(find.text(c));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'filter "$c"');
    }

    // Money: drain the approvals queue.
    await openTab(tester, 'Money');
    await tester.tap(find.text('Approve').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'approve');
    await tester.tap(find.text('Reject').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'reject');
    expect(find.text('Nothing awaiting approval.'), findsOneWidget);
  });
}
