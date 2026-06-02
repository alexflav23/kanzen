import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

void main() {
  testWidgets(
      'a signed-in principal sees all six tabs, opening on the dashboard',
      (tester) async {
    final session = mockSession(router: (req) {
      if (req.url.path == '/api/dashboard') {
        return {
          'pendingApprovals': 2,
          'properties': 2,
          'assets': 180,
          'expiringPermits': 1
        };
      }
      return null;
    });
    await pumpApp(tester, session);

    expect(find.byType(NavigationBar), findsOneWidget);
    for (final tab in [
      'Home',
      'Inventory',
      'Properties',
      'People',
      'Money',
      'Triage'
    ]) {
      expect(navTab(tab), findsOneWidget);
    }
    // Default tab = Home = live dashboard greeting + stat.
    expect(find.text('Good morning.'), findsOneWidget);
    expect(find.text('Welcome back, Toby.'), findsOneWidget);
    expect(find.text('180'), findsOneWidget); // live asset count
  });
}
