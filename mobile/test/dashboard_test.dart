import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

void main() {
  testWidgets('dashboard renders the live foundation stats', (tester) async {
    final session = mockSession(router: (req) {
      if (req.url.path == '/api/dashboard') {
        return {
          'pendingApprovals': 3,
          'properties': 2,
          'assets': 142,
          'expiringPermits': 1
        };
      }
      return null;
    });
    await pumpApp(tester, session);

    expect(find.text('3'), findsOneWidget); // pending approvals
    expect(find.text('142'), findsOneWidget); // assets
    expect(find.text('Pending approvals'), findsOneWidget);
    expect(find.text('Permits expiring'), findsOneWidget);
  });
}
