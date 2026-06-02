import 'api_client.dart';
import 'models.dart';

/// The typed service layer — one method per endpoint the companion consumes,
/// the Dart analogue of the per-domain files in web/src/services/*. Hand-written
/// (no generated client), decoding through the [models]. Authz is enforced by
/// the backend; out-of-scope reads surface as [ApiException] (403/404).
class KanzenApi {
  final ApiClient _c;
  KanzenApi(this._c);

  // ---- auth -----------------------------------------------------------------

  /// DEV sign-in: ask the backend to mint a local JWT for a persona
  /// (POST /api/dev/token). Replaced by the Cognito hosted-UI token in prod.
  Future<String> devToken(String email, String role) async {
    final j = await _c.post('/api/dev/token', {'email': email, 'role': role});
    return (j as Map<String, dynamic>)['token'] as String;
  }

  Future<Me> getMe() async =>
      Me.fromJson(await _c.get('/api/me') as Map<String, dynamic>);

  // ---- reads ----------------------------------------------------------------

  Future<Summary> dashboard() async =>
      Summary.fromJson(await _c.get('/api/dashboard') as Map<String, dynamic>);

  Future<List<Property>> properties() async =>
      ((await _c.get('/api/properties')) as List)
          .map((j) => Property.fromJson(j as Map<String, dynamic>))
          .toList();

  Future<List<Asset>> assets() async => ((await _c.get('/api/assets')) as List)
      .map((j) => Asset.fromJson(j as Map<String, dynamic>))
      .toList();

  Future<List<Person>> people() async => ((await _c.get('/api/people')) as List)
      .map((j) => Person.fromJson(j as Map<String, dynamic>))
      .toList();

  Future<List<Expense>> expenses() async =>
      ((await _c.get('/api/expenses')) as List)
          .map((j) => Expense.fromJson(j as Map<String, dynamic>))
          .toList();

  // ---- writes (all server-authz'd + audited) --------------------------------

  /// F17 — approve a submitted expense (Manager+/Principal). Kanzen never moves
  /// money; this records the approval decision only.
  Future<void> approveExpense(String id) =>
      _c.post('/api/expenses/$id/approve');
  Future<void> rejectExpense(String id) => _c.post('/api/expenses/$id/reject');

  /// F26 — the Triage stream: proposed agent actions awaiting review.
  Future<List<AgentAction>> agentActions([String status = 'proposed']) async =>
      ((await _c.get('/api/agent/actions?status=$status')) as List)
          .map((j) => AgentAction.fromJson(j as Map<String, dynamic>))
          .toList();

  /// F27 — confirm/reject an agent proposal. Financial/asset items still require
  /// an explicit individual confirm; nothing auto-commits.
  Future<void> confirmAction(String id) =>
      _c.post('/api/agent/actions/$id/confirm');
  Future<void> rejectAction(String id) =>
      _c.post('/api/agent/actions/$id/reject');
}
