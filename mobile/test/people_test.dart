import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/widgets/pill.dart';
import 'support.dart';

void main() {
  testWidgets('people lists the team and flags the expiring permit', (tester) async {
    await pumpApp(tester);
    await openTab(tester, 'People');

    for (final name in ['Toby', 'Lorna', 'Marcia', 'Siti']) {
      expect(find.text(name), findsOneWidget);
    }
    // Only Siti's permit (<90 days) is flagged, with a warn pill.
    expect(find.widgetWithText(Pill, 'Work permit · 50d'), findsOneWidget);
  });
}
