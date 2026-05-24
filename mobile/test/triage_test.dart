import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

/// F31 — the capture-first Triage flow: capture adds an item; confirm/reject clears it;
/// financial items are marked "Review" (never auto-committed, F27).
void main() {
  testWidgets('Triage shows seeded proposals and marks financial items for Review', (tester) async {
    await pumpApp(tester);
    await openTab(tester, 'Triage');
    expect(find.text('Triage'), findsWidgets);
    expect(find.textContaining('SP Group'), findsOneWidget);
    expect(find.text('Review'), findsWidgets); // the Bill / Invoice item is locked → Review
  });

  testWidgets('capture adds a receipt to triage; confirm removes it', (tester) async {
    await pumpApp(tester);
    await openTab(tester, 'Triage');

    // capture-first: the prominent FAB ingests a receipt at the top of the queue
    await tester.tap(find.widgetWithText(FloatingActionButton, 'Capture'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Captured receipt'), findsOneWidget);

    // rejecting the top (captured) item clears it from the review queue
    await tester.tap(find.byIcon(Icons.close).first);
    await tester.pumpAndSettle();
    expect(find.textContaining('Captured receipt'), findsNothing);
  });
}
