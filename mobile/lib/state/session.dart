import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/kanzen_api.dart';
import '../api/models.dart';

/// The real household personas (mirror the web `PERSONAS` + the V2_21 seed). Used
/// by the dev sign-in until a Cognito pool is wired; the role flows into the
/// backend's default-deny Authorizer.
class Persona {
  final String name;
  final String email;
  final String role;
  const Persona(this.name, this.email, this.role);
}

const kPersonas = <Persona>[
  Persona('Flavian', 'flavian@kanzen.local', 'principal'),
  Persona('Lorna', 'lorna@kanzen.local', 'manager'),
  Persona('Marcia', 'marcia@kanzen.local', 'staff'),
  Persona('Siti', 'siti@kanzen.local', 'staff'),
];

enum AuthStatus { loading, signedOut, signedIn }

const _tokenKey = 'kanzen.token';

/// Holds the session: the bearer token (persisted across launches) + the
/// resolved [Me] from /api/me. The single source of identity/authz on mobile;
/// the role-gated UI reads [can] exactly as the web nav does.
///
/// Sign-in goes through [signInDev] today; the real Cognito hosted-UI flow drops
/// in behind the same `token -> getMe()` seam with no change to consumers.
class Session extends ChangeNotifier {
  final ApiClient client;
  Session(this.client);

  AuthStatus status = AuthStatus.loading;
  Me? me;
  String? error;

  KanzenApi get api => KanzenApi(client);

  /// Restore a persisted token on launch and resolve the principal. An expired
  /// or rejected token is dropped (→ signed out) rather than locking the user in
  /// a broken state.
  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_tokenKey);
    if (saved == null || saved.isEmpty) {
      _set(AuthStatus.signedOut);
      return;
    }
    client.token = saved;
    try {
      me = await api.getMe();
      _set(AuthStatus.signedIn);
    } on ApiException {
      client.token = null;
      await prefs.remove(_tokenKey);
      _set(AuthStatus.signedOut);
    }
  }

  Future<void> signInDev(Persona persona) async {
    error = null;
    notifyListeners();
    try {
      final token = await api.devToken(persona.email, persona.role);
      client.token = token;
      me = await api.getMe();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      _set(AuthStatus.signedIn);
    } on ApiException catch (e) {
      client.token = null;
      error = e.status == 0 ? e.detail : 'Sign-in failed: ${e.detail}';
      _set(AuthStatus.signedOut);
    }
  }

  Future<void> signOut() async {
    client.token = null;
    me = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    _set(AuthStatus.signedOut);
  }

  bool can(String resource, [String level = 'read']) =>
      me?.can(resource, level) ?? false;

  void _set(AuthStatus s) {
    status = s;
    notifyListeners();
  }
}

/// Exposes the [Session] to the widget tree (analogue of the web AuthContext).
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope(
      {super.key, required Session session, required super.child})
      : super(notifier: session);

  static Session of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<SessionScope>();
    assert(scope != null, 'No SessionScope found in context');
    return scope!.notifier!;
  }
}
