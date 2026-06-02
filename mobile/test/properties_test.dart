import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/widgets/pill.dart';
import 'support.dart';

void main() {
  testWidgets('properties shows the API property cards with their stats',
      (tester) async {
    final session = mockSession(router: (req) {
      if (req.url.path == '/api/properties') {
        return [
          _prop('w', 'Wardian, Apt 5206', 'UK', rooms: 8, assets: 142),
          _prop('s', 'Singapore', 'SG', rooms: 6, assets: 38),
        ];
      }
      return null;
    });
    await pumpApp(tester, session);
    await openTab(tester, 'Properties');

    expect(find.text('Wardian, Apt 5206'), findsOneWidget);
    expect(find.text('Singapore'), findsOneWidget);
    expect(find.text('142'), findsOneWidget);
    expect(find.text('Rooms'), findsNWidgets(2));
    expect(find.widgetWithText(Pill, 'UK'), findsOneWidget);
    expect(find.widgetWithText(Pill, 'SG'), findsOneWidget);
  });
}

Map<String, Object?> _prop(String id, String name, String jur,
        {required int rooms, required int assets}) =>
    {
      'id': id,
      'name': name,
      'jurisdiction': jur,
      'currency': 'GBP',
      'status': 'active',
      'rooms': rooms,
      'assets': assets,
      'bills': 11,
      'vendors': 6,
    };
