import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

/// F31 capture-first — Triage lists the agent's proposed actions (GET
/// /api/agent/actions), marks financial/asset items for Review (F27), and
/// confirm/reject hit the real endpoints. The Capture FAB opens the capture seam.
void main() {
  testWidgets(
      'lists proposals, flags financial ones for Review, confirm removes one',
      (tester) async {
    final actions = <Map<String, Object?>>[
      _action('a1', 'create_receipt', 'Receipt', 'Ocado · grocery delivery',
          locked: true),
      _action('a2', 'create_event', 'Delivery', 'UPS · parcel Tue',
          locked: false),
    ];
    final session = mockSession(router: (http.Request req) {
      if (req.method == 'GET' && req.url.path == '/api/agent/actions') {
        return actions;
      }
      final parts =
          req.url.path.split('/'); // ['','api','agent','actions',(id),(verb)]
      if (req.method == 'POST' && parts.length == 6 && parts[3] == 'actions') {
        actions.removeWhere((a) => a['id'] == parts[4]);
        return {'ok': true};
      }
      return null;
    });
    await pumpApp(tester, session);
    await openTab(tester, 'Triage');

    expect(find.text('2 items to review'), findsOneWidget);
    expect(find.text('Ocado · grocery delivery'), findsOneWidget);
    expect(find.text('Review'), findsWidgets); // a1 is locked → Review pill

    await tester.tap(find.text('Confirm (review)')); // the locked item's button
    await tester.pumpAndSettle();
    expect(find.text('1 item to review'), findsOneWidget);
    expect(find.text('Ocado · grocery delivery'), findsNothing);
  });

  testWidgets('the Capture FAB opens the capture seam', (tester) async {
    final session = mockSession(
        router: (req) =>
            req.url.path == '/api/agent/actions' ? <Object?>[] : null);
    await pumpApp(tester, session);
    await openTab(tester, 'Triage');

    expect(find.text('All clear — nothing to triage.'), findsOneWidget);
    await tester.tap(find.widgetWithText(FloatingActionButton, 'Capture'));
    await tester.pumpAndSettle();
    // The sandbox capture sheet explains the device flow.
    expect(find.text('Got it'), findsOneWidget);
    expect(
        find.textContaining('camera uploads the photo to S3'), findsOneWidget);
  });
}

Map<String, Object?> _action(String id, String type, String cat, String subject,
        {required bool locked}) =>
    {
      'id': id,
      'actionType': type,
      'status': 'proposed',
      'category': cat,
      'subject': subject,
      'locked': locked,
    };
