import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/main.dart';

/// A bottom-nav tab, scoped so it never collides with a screen heading of the
/// same name (e.g. the "Inventory" tab vs the "Inventory" title).
Finder navTab(String label) =>
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

Future<void> pumpApp(WidgetTester tester) async {
  await tester.pumpWidget(const KanzenApp());
  await tester.pumpAndSettle();
}

Future<void> openTab(WidgetTester tester, String label) async {
  await tester.tap(navTab(label));
  await tester.pumpAndSettle();
}
