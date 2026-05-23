import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

void main() {
  testWidgets('finance queue: approve then reject clears it to the empty state', (tester) async {
    await pumpApp(tester);
    await openTab(tester, 'Money');

    expect(find.text('Bills, expenses & budgets'), findsOneWidget);
    expect(find.text('2 pending your approval.'), findsOneWidget);
    // Multi-currency renders (each amount appears in both the queue and ledger).
    expect(find.text('£1,840'), findsWidgets);
    expect(find.text('S\$2,640'), findsWidgets);

    await tester.tap(find.text('Approve').first);
    await tester.pumpAndSettle();
    expect(find.text('1 pending your approval.'), findsOneWidget);

    await tester.tap(find.text('Reject').first);
    await tester.pumpAndSettle();
    expect(find.text('0 pending your approval.'), findsOneWidget);
    expect(find.text('Nothing awaiting approval.'), findsOneWidget);
    // Decided expenses stay in the ledger with their new statuses.
    expect(find.text('rejected'), findsOneWidget);
  });
}
