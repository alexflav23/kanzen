import 'package:http/http.dart' as http;
import 'package:flutter_test/flutter_test.dart';
import 'package:kanzen_mobile/state/session.dart';
import 'support.dart';

/// Full-app audit — the Flutter analogue of the web Playwright audit. Walks every
/// tab and the key interactions against a fully-populated mock backend; after
/// each step it asserts the framework recorded no exception (layout overflow,
/// build error, failed assertion all surface through takeException). The mobile
/// equivalent of "zero console errors".
void main() {
  Session fullSession() => mockSession(router: (http.Request req) {
        final p = req.url.path;
        switch (p) {
          case '/api/dashboard':
            return {
              'pendingApprovals': 1,
              'properties': 2,
              'assets': 142,
              'expiringPermits': 1
            };
          case '/api/assets':
            return [
              {
                'id': '1',
                'title': 'Royal Oak',
                'maker': 'Audemars Piguet',
                'categoryId': null,
                'trackingMode': 'unique',
                'quantity': 1,
                'ownershipStatus': 'owned',
                'acquisitionCostMinor': 4200000,
                'acquisitionCurrency': 'GBP',
                'attributes': <String, Object?>{}
              }
            ];
          case '/api/properties':
            return [
              {
                'id': 'w',
                'name': 'Wardian, Apt 5206',
                'jurisdiction': 'UK',
                'currency': 'GBP',
                'status': 'active',
                'rooms': 8,
                'assets': 142,
                'bills': 11,
                'vendors': 6
              }
            ];
          case '/api/people':
            return [
              {
                'id': 'toby',
                'userId': null,
                'name': 'Toby',
                'role': 'Principal',
                'jurisdiction': 'UK',
                'propertyId': null,
                'permitExpiry': null,
                'reviewDue': null,
                'colour': null
              }
            ];
          case '/api/expenses':
            return [
              {
                'id': 'e1',
                'payee': 'Hudson Sandler',
                'amountMinor': 184000,
                'currency': 'GBP',
                'status': 'pending_approval',
                'deductible': false,
                'vatReclaimable': false
              }
            ];
          case '/api/agent/actions':
            return [
              {
                'id': 'a1',
                'actionType': 'create_receipt',
                'status': 'proposed',
                'category': 'Receipt',
                'subject': 'Ocado · grocery',
                'locked': true
              }
            ];
        }
        // approve/reject/confirm/reject writes
        if (req.method == 'POST') return {'ok': true};
        return null;
      });

  testWidgets('every tab + key interaction is clean (no exceptions/overflow)',
      (tester) async {
    await pumpApp(tester, fullSession());
    expect(tester.takeException(), isNull, reason: 'boot');

    for (final tab in [
      'Home',
      'Inventory',
      'Properties',
      'People',
      'Money',
      'Triage',
      'Home'
    ]) {
      await openTab(tester, tab);
      expect(tester.takeException(), isNull, reason: 'open tab "$tab"');
    }

    // Money: approve the queued expense.
    await openTab(tester, 'Money');
    await tester.tap(find.text('Approve').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'approve');

    // Triage: confirm the proposal.
    await openTab(tester, 'Triage');
    await tester.tap(find.text('Confirm (review)'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'confirm');
  });
}
