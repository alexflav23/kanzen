import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/main.dart';

void main() {
  testWidgets('shell shows the greeting and the 5-tab bar', (tester) async {
    await tester.pumpWidget(const KanzenApp());
    expect(find.text('Good morning'), findsOneWidget);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Home'), findsWidgets);
    expect(find.text('Triage'), findsWidgets);
    expect(find.text('Money'), findsWidgets);
    expect(find.text('Search'), findsWidgets);
  });

  testWidgets('tapping a tab switches the body', (tester) async {
    await tester.pumpWidget(const KanzenApp());
    await tester.tap(find.text('Money'));
    await tester.pumpAndSettle();
    // The body now shows the selected tab's name.
    expect(find.widgetWithText(Center, 'Money'), findsOneWidget);
  });
}
