import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kanzen_mobile/api/api_client.dart';

/// Pure unit tests of the HTTP boundary — the mobile analogue of the web
/// http.ts contract (bearer attachment + the {status,code,detail} error model).
void main() {
  test('attaches the bearer token when present, omits it otherwise', () async {
    String? seen;
    final c = ApiClient(
      baseUrl: 'http://test',
      token: 'tok-123',
      httpClient: MockClient((req) async {
        seen = req.headers['Authorization'];
        return http.Response(jsonEncode({'ok': true}), 200);
      }),
    );
    await c.get('/api/me');
    expect(seen, 'Bearer tok-123');
  });

  test('maps a 403 to ApiException.forbidden, reading code/detail', () async {
    final c = ApiClient(
      baseUrl: 'http://test',
      httpClient: MockClient((req) async => http.Response(
          jsonEncode({'code': 'forbidden', 'detail': 'not your scope'}), 403)),
    );
    try {
      await c.get('/api/assets');
      fail('expected ApiException');
    } on ApiException catch (e) {
      expect(e.forbidden, isTrue);
      expect(e.code, 'forbidden');
      expect(e.detail, 'not your scope');
    }
  });

  test('a network failure surfaces as status 0 / network', () async {
    final c = ApiClient(
      baseUrl: 'http://test',
      httpClient: MockClient((req) async => throw Exception('down')),
    );
    try {
      await c.get('/api/me');
      fail('expected ApiException');
    } on ApiException catch (e) {
      expect(e.status, 0);
      expect(e.code, 'network');
    }
  });

  test('serialises a JSON body and sets Content-Type on writes', () async {
    Map<String, String>? headers;
    String? body;
    final c = ApiClient(
      baseUrl: 'http://test',
      httpClient: MockClient((req) async {
        headers = req.headers;
        body = req.body;
        return http.Response(jsonEncode({'ok': true}), 200);
      }),
    );
    await c.post('/api/expenses/x/approve', {'note': 'ok'});
    expect(headers!['Content-Type'], contains('application/json'));
    expect(jsonDecode(body!), {'note': 'ok'});
  });
}
