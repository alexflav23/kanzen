import 'package:http/http.dart' as http;
import 'package:flutter_test/flutter_test.dart';
import 'support.dart';

/// F17/F31 — the Money tab's approvals queue against the real endpoints:
/// approve/reject POST to /api/expenses/:id/{approve,reject} and the queue
/// reloads from the live list.
void main() {
  testWidgets('approve then reject drains the queue to the empty state',
      (tester) async {
    final expenses = <Map<String, Object?>>[
      _exp('e1', 'Hudson Sandler', 184000, 'GBP', 'pending_approval'),
      _exp('e2', 'SG Roofing', 264000, 'SGD', 'pending_approval'),
      _exp('e3', 'Waitrose', 8400, 'GBP', 'approved'),
    ];
    final session = mockSession(router: (http.Request req) {
      final parts =
          req.url.path.split('/'); // ['','api','expenses',(id),(verb)]
      if (req.method == 'GET' && req.url.path == '/api/expenses') {
        return expenses;
      }
      if (req.method == 'POST' && parts.length == 5 && parts[2] == 'expenses') {
        final id = parts[3];
        final verb = parts[4];
        for (final e in expenses) {
          if (e['id'] == id) {
            e['status'] = verb == 'approve' ? 'approved' : 'rejected';
          }
        }
        return {'ok': true};
      }
      return null;
    });
    await pumpApp(tester, session);
    await openTab(tester, 'Money');

    expect(find.text('2 pending your approval.'), findsOneWidget);
    expect(find.text('£1,840'), findsWidgets);
    expect(find.text('S\$2,640'), findsWidgets);

    await tester.tap(find.text('Approve').first);
    await tester.pumpAndSettle();
    expect(find.text('1 pending your approval.'), findsOneWidget);

    await tester.tap(find.text('Reject').first);
    await tester.pumpAndSettle();
    expect(find.text('0 pending your approval.'), findsOneWidget);
    expect(find.text('Nothing awaiting approval.'), findsOneWidget);
  });
}

Map<String, Object?> _exp(
        String id, String payee, int minor, String ccy, String status) =>
    {
      'id': id,
      'payee': payee,
      'amountMinor': minor,
      'currency': ccy,
      'status': status,
      'deductible': false,
      'vatReclaimable': false,
    };
