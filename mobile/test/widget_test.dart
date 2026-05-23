import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

void main() {
  testWidgets('shell renders the 5 parity tabs and opens on the dashboard', (tester) async {
    await pumpApp(tester);
    expect(find.byType(NavigationBar), findsOneWidget);
    for (final tab in ['Home', 'Inventory', 'Properties', 'People', 'Money']) {
      expect(navTab(tab), findsOneWidget);
    }
    // Default tab = Home = Dashboard greeting.
    expect(find.text('Good morning.'), findsOneWidget);
  });
}
