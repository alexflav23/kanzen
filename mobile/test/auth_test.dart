import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

/// F01/F31 — the real sign-in flow: no persisted token → the login screen; a
/// persona tap mints a token (POST /api/dev/token), resolves /api/me, and lands
/// in the signed-in shell. Sign-out returns to login.
void main() {
  testWidgets('signed-out → persona sign-in → signed-in shell', (tester) async {
    final session = mockSession(router: (req) {
      if (req.url.path == '/api/dashboard') {
        return {
          'pendingApprovals': 0,
          'properties': 2,
          'assets': 0,
          'expiringPermits': 0
        };
      }
      return null;
    });
    await pumpApp(tester, session, token: null);

    // Login screen with the household personas.
    expect(find.text('Companion — sign in to continue'), findsOneWidget);
    expect(find.text('Flavian'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);

    await tester.tap(find.text('Flavian'));
    await tester.pumpAndSettle();

    // Now authenticated: the shell + live dashboard render.
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Good morning.'), findsOneWidget);

    // signOut returns to the login screen.
    await session.signOut();
    await tester.pumpAndSettle();
    expect(find.text('Companion — sign in to continue'), findsOneWidget);
  });
}
