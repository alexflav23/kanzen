import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/widgets/pill.dart';
import 'support.dart';

void main() {
  testWidgets('properties shows the seed property cards with stats', (tester) async {
    await pumpApp(tester);
    await openTab(tester, 'Properties');

    expect(find.text('Wardian, Apt 5206'), findsOneWidget);
    expect(find.text('Singapore'), findsOneWidget);
    expect(find.text('London E14'), findsOneWidget);
    expect(find.text('Marina Bay'), findsOneWidget);
    // Stats grid: Wardian has 142 assets, both cards render the "Rooms" label.
    expect(find.text('142'), findsOneWidget);
    expect(find.text('Rooms'), findsNWidgets(2));
    // Jurisdiction pills.
    expect(find.widgetWithText(Pill, 'UK'), findsOneWidget);
    expect(find.widgetWithText(Pill, 'SG'), findsOneWidget);
  });
}
