import 'dart:convert';
import 'package:http/http.dart' as http;

/// A typed API failure — mirrors the web's `ApiError` (web/src/services/http.ts).
/// `status == 0` means the network/server was unreachable.
class ApiException implements Exception {
  final int status;
  final String code;
  final String detail;
  ApiException(this.status, this.code, this.detail);

  bool get unauthorized => status == 401;
  bool get forbidden => status == 403;
  bool get notFound => status == 404;

  @override
  String toString() => '$code: $detail';
}

/// The single place the companion talks to the backend. Mirrors the web `api()`
/// wrapper: attaches the bearer token, maps non-2xx to [ApiException] by reading
/// the backend's `{status,code,detail}` shape, and surfaces network failures.
///
/// The `http.Client` is injectable so widget tests can drive it with a
/// `MockClient` (package:http/testing) — no live backend needed in CI.
class ApiClient {
  final String baseUrl;
  final http.Client _http;

  /// The current bearer token (Cognito ID token in prod, dev-minted JWT in the
  /// sandbox). Mutated by [Session] on sign-in/out.
  String? token;

  ApiClient({required this.baseUrl, http.Client? httpClient, this.token})
      : _http = httpClient ?? http.Client();

  Future<dynamic> get(String path) => _send('GET', path, null);
  Future<dynamic> post(String path, [Object? body]) =>
      _send('POST', path, body);
  Future<dynamic> patch(String path, [Object? body]) =>
      _send('PATCH', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path, null);

  Future<dynamic> _send(String method, String path, Object? body) async {
    http.Response res;
    try {
      final req = http.Request(method, Uri.parse('$baseUrl$path'));
      req.headers['Accept'] = 'application/json';
      if (token != null && token!.isNotEmpty) {
        req.headers['Authorization'] = 'Bearer $token';
      }
      if (body != null) {
        req.headers['Content-Type'] = 'application/json';
        req.body = jsonEncode(body);
      }
      res = await http.Response.fromStream(await _http.send(req));
    } catch (_) {
      throw ApiException(0, 'network', 'Could not reach the Kanzen API.');
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      var code = 'error';
      var detail = res.reasonPhrase ?? 'HTTP ${res.statusCode}';
      try {
        final m = jsonDecode(res.body) as Map<String, dynamic>;
        if (m['code'] is String) code = m['code'] as String;
        if (m['detail'] is String) detail = m['detail'] as String;
      } catch (_) {
        // non-JSON error body — keep the status-line defaults
      }
      throw ApiException(res.statusCode, code, detail);
    }

    if (res.body.isEmpty) return null;
    return jsonDecode(res.body);
  }
}
