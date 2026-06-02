import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:kanzen_mobile/api/api_client.dart';
import 'package:kanzen_mobile/main.dart';
import 'package:kanzen_mobile/state/session.dart';

/// The seeded principal (Toby) — full access (the `*` admin rule), so all tabs show.
const principalMe = {
  'userId': 'u-toby',
  'name': 'Toby',
  'email': 'flavian@kanzen.local',
  'role': 'principal',
  'colour': '',
  'permissions': [
    {'resource': '*', 'field': null, 'level': 'admin'}
  ],
  'impersonatedBy': null,
};

/// A Staff member (Marcia) — only people + properties read; no asset/finance access.
const staffMe = {
  'userId': 'u-marcia',
  'name': 'Marcia',
  'email': 'marcia@kanzen.local',
  'role': 'staff',
  'colour': '',
  'permissions': [
    {'resource': 'person', 'field': null, 'level': 'read'},
    {'resource': 'property', 'field': null, 'level': 'read'},
  ],
  'impersonatedBy': null,
};

/// Build a [Session] backed by an in-memory MockClient. The optional [router]
/// answers domain endpoints; it may return a JSON-encodable value (→ 200) or a
/// full [http.Response] (to drive status codes like 403). /api/me and
/// /api/dev/token are answered by default.
Session mockSession({
  Map<String, dynamic> me = principalMe,
  Object? Function(http.Request req)? router,
}) {
  final client = ApiClient(
    baseUrl: 'http://test',
    httpClient: MockClient((req) async {
      final path = req.url.path;
      if (path == '/api/dev/token') {
        return _json({'token': 'dev-jwt', 'note': 'dev'});
      }
      if (path == '/api/me') return _json(me);
      final r = router?.call(req);
      if (r is http.Response) return r;
      if (r == null) return _json({'code': 'not_found', 'detail': path}, 404);
      return _json(r);
    }),
  );
  return Session(client);
}

http.Response _json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status,
        headers: {'content-type': 'application/json'});

/// Boot the app with [session]. By default a persisted token is present, so the
/// app bootstraps straight into the signed-in shell; pass `token: null` to start
/// at the login screen.
Future<void> pumpApp(WidgetTester tester, Session session,
    {String? token = 'dev-jwt'}) async {
  SharedPreferences.setMockInitialValues(
      token == null ? {} : {'kanzen.token': token});
  await tester.pumpWidget(KanzenApp(session: session));
  await tester.pumpAndSettle();
}

/// A bottom-nav tab, scoped so it never collides with a screen heading of the
/// same name (e.g. the "Inventory" tab vs the "Inventory" title).
Finder navTab(String label) =>
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

Future<void> openTab(WidgetTester tester, String label) async {
  await tester.tap(navTab(label));
  await tester.pumpAndSettle();
}
