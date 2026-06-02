import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

void main() {
  testWidgets('people lists the roster and flags an expiring permit',
      (tester) async {
    final soon = DateTime.now()
        .add(const Duration(days: 50))
        .toIso8601String()
        .substring(0, 10);
    final far = DateTime.now()
        .add(const Duration(days: 800))
        .toIso8601String()
        .substring(0, 10);
    final session = mockSession(router: (req) {
      if (req.url.path == '/api/people') {
        return [
          _person('toby', 'Toby', 'Principal', null),
          _person('marcia', 'Marcia', 'Housekeeper', far),
          _person('siti', 'Siti', 'Housekeeper', soon), // < 90 days → flagged
        ];
      }
      return null;
    });
    await pumpApp(tester, session);
    await openTab(tester, 'People');

    for (final name in ['Toby', 'Marcia', 'Siti']) {
      expect(find.text(name), findsOneWidget);
    }
    // Only Siti's near-expiry permit is flagged, with a warn pill.
    expect(find.textContaining('Work permit ·'), findsOneWidget);
  });
}

Map<String, Object?> _person(
        String id, String name, String role, String? permitExpiry) =>
    {
      'id': id,
      'userId': null,
      'name': name,
      'role': role,
      'jurisdiction': 'UK',
      'propertyId': null,
      'permitExpiry': permitExpiry,
      'reviewDue': null,
      'colour': null,
    };
