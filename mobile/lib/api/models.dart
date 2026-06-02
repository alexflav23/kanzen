// Dart models at the API boundary — the hand-decoded analogue of the web's Zod
// schemas (web/src/services/*). One `fromJson` per shape; nullable fields stay
// nullable, money stays integer minor units + ISO currency (never float).

String? _str(Object? v) => v == null ? null : v as String;
int _int(Object? v) => (v as num).toInt();
int? _intN(Object? v) => v == null ? null : (v as num).toInt();

/// F02 — one permission rule (resource/field → level), as the Authorizer holds it.
class Perm {
  final String resource;
  final String? field;
  final String level;
  Perm(this.resource, this.field, this.level);
  factory Perm.fromJson(Map<String, dynamic> j) =>
      Perm(j['resource'] as String, _str(j['field']), j['level'] as String);
}

const _rank = {'none': 0, 'read': 1, 'write': 2, 'admin': 3};

/// F01/F02 — the authenticated principal + effective permission set (GET /api/me).
class Me {
  final String userId;
  final String name;
  final String email;
  final String role;
  final String colour;
  final List<Perm> permissions;
  final String? impersonatedBy;

  Me({
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    required this.colour,
    required this.permissions,
    required this.impersonatedBy,
  });

  factory Me.fromJson(Map<String, dynamic> j) => Me(
        userId: j['userId'] as String,
        name: j['name'] as String,
        email: j['email'] as String,
        role: j['role'] as String,
        colour: (j['colour'] as String?) ?? '',
        permissions: (j['permissions'] as List)
            .map((p) => Perm.fromJson(p as Map<String, dynamic>))
            .toList(),
        impersonatedBy: _str(j['impersonatedBy']),
      );

  bool get impersonating => impersonatedBy != null;

  /// Mirror the backend Authorizer: most-specific wins (resource rule > `*`
  /// wildcard); default-deny. Resource-level only — field-level filtering stays
  /// server-side. Drives the mobile nav/tab recalibration.
  bool can(String resource, [String level = 'read']) {
    final req = _rank[level] ?? 1;
    final rule = permissions.firstWhere(
      (p) => p.resource == resource && p.field == null,
      orElse: () => permissions.firstWhere(
        (p) => p.resource == '*' && p.field == null,
        orElse: () => Perm('', null, 'none'),
      ),
    );
    return (_rank[rule.level] ?? 0) >= req;
  }
}

/// F29 — dashboard summary (GET /api/dashboard).
class Summary {
  final int pendingApprovals;
  final int properties;
  final int assets;
  final int expiringPermits;
  Summary(this.pendingApprovals, this.properties, this.assets,
      this.expiringPermits);
  factory Summary.fromJson(Map<String, dynamic> j) => Summary(
        _int(j['pendingApprovals']),
        _int(j['properties']),
        _int(j['assets']),
        _int(j['expiringPermits']),
      );
}

/// F03 — property list card (GET /api/properties).
class Property {
  final String id;
  final String name;
  final String? jurisdiction;
  final String currency;
  final String status;
  final int rooms, assets, bills, vendors;
  Property(this.id, this.name, this.jurisdiction, this.currency, this.status,
      this.rooms, this.assets, this.bills, this.vendors);
  factory Property.fromJson(Map<String, dynamic> j) => Property(
        j['id'] as String,
        j['name'] as String,
        _str(j['jurisdiction']),
        j['currency'] as String,
        j['status'] as String,
        _int(j['rooms']),
        _int(j['assets']),
        _int(j['bills']),
        _int(j['vendors']),
      );
}

/// F04 — asset list card (GET /api/assets).
class Asset {
  final String id;
  final String title;
  final String? maker;
  final int? acquisitionCostMinor;
  final String? acquisitionCurrency;
  final String ownershipStatus;
  Asset(this.id, this.title, this.maker, this.acquisitionCostMinor,
      this.acquisitionCurrency, this.ownershipStatus);
  factory Asset.fromJson(Map<String, dynamic> j) => Asset(
        j['id'] as String,
        j['title'] as String,
        _str(j['maker']),
        _intN(j['acquisitionCostMinor']),
        _str(j['acquisitionCurrency']),
        (j['ownershipStatus'] as String?) ?? 'owned',
      );
}

/// F10 — a person/HR record (GET /api/people).
class Person {
  final String id;
  final String name;
  final String? role;
  final String? jurisdiction;
  final String? permitExpiry; // ISO date
  Person(this.id, this.name, this.role, this.jurisdiction, this.permitExpiry);
  factory Person.fromJson(Map<String, dynamic> j) => Person(
        j['id'] as String,
        j['name'] as String,
        _str(j['role']),
        _str(j['jurisdiction']),
        _str(j['permitExpiry']),
      );

  /// Whole days from today until the permit expiry (negative if past), or null.
  int? get permitDays {
    final iso = permitExpiry;
    if (iso == null) return null;
    final then = DateTime.tryParse(iso);
    if (then == null) return null;
    return then.difference(DateTime.now()).inDays;
  }
}

/// F17 — an expense (GET /api/expenses).
class Expense {
  final String id;
  final String? payee;
  final int amountMinor;
  final String currency;
  final String status;
  Expense(this.id, this.payee, this.amountMinor, this.currency, this.status);
  factory Expense.fromJson(Map<String, dynamic> j) => Expense(
        j['id'] as String,
        _str(j['payee']),
        _int(j['amountMinor']),
        j['currency'] as String,
        j['status'] as String,
      );

  bool get pending => status == 'pending_approval';
}

/// F25/F26 — a proposed agent action in the Triage stream (GET /api/agent/actions).
class AgentAction {
  final String id;
  final String actionType;
  final String status;
  final String? category;
  final String? subject;
  final bool locked; // F27 — financial/asset proposals are never auto-committed
  AgentAction(this.id, this.actionType, this.status, this.category,
      this.subject, this.locked);
  factory AgentAction.fromJson(Map<String, dynamic> j) => AgentAction(
        j['id'] as String,
        j['actionType'] as String,
        j['status'] as String,
        _str(j['category']),
        _str(j['subject']),
        (j['locked'] as bool?) ?? false,
      );
}
