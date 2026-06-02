import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

/// F31 AC1/AC7 — the app reflects the user's role/scope. A Staff member sees
/// only the tabs their permissions allow (no Inventory/Money), and an
/// out-of-scope read surfaces the forbidden state rather than leaking data.
void main() {
  testWidgets('Staff sees a role-trimmed tab bar (no Inventory/Money)',
      (tester) async {
    final session = mockSession(
        me: staffMe,
        router: (req) {
          if (req.url.path == '/api/dashboard') {
            return {
              'pendingApprovals': 0,
              'properties': 1,
              'assets': 0,
              'expiringPermits': 0
            };
          }
          return null;
        });
    await pumpApp(tester, session);

    expect(navTab('Home'), findsOneWidget);
    expect(navTab('Properties'), findsOneWidget);
    expect(navTab('People'), findsOneWidget);
    expect(navTab('Triage'), findsOneWidget);
    // Asset/finance surfaces are not even offered to Staff.
    expect(navTab('Inventory'), findsNothing);
    expect(navTab('Money'), findsNothing);
  });

  testWidgets('a 403 read renders the forbidden state (no data leak)',
      (tester) async {
    // Principal (all tabs) but the backend forbids this particular read.
    final session = mockSession(router: (http.Request req) {
      if (req.url.path == '/api/assets') {
        return http.Response('{"code":"forbidden","detail":"nope"}', 403,
            headers: {'content-type': 'application/json'});
      }
      return null;
    });
    await pumpApp(tester, session);
    await openTab(tester, 'Inventory');

    expect(find.text('No access'), findsOneWidget);
    expect(find.byType(Card), findsNothing);
  });
}
