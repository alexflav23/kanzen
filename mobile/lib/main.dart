import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'state/session.dart';
import 'theme.dart';
import 'screens/login.dart';
import 'screens/dashboard.dart';
import 'screens/inventory.dart';
import 'screens/finance.dart';
import 'screens/properties.dart';
import 'screens/people.dart';
import 'screens/triage.dart';

/// Backend base URL. Defaults to the local docker stack; override at build time
/// with `--dart-define=API_BASE=...` (e.g. `http://10.0.2.2:8080` on the Android
/// emulator, or the prod ALB host).
const apiBaseUrl =
    String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:8080');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(KanzenApp(session: Session(ApiClient(baseUrl: apiBaseUrl))));
}

/// F31 — Kanzen companion. A real client against the same `/api` as the web app:
/// Cognito/dev auth, the resolved principal from /api/me, and role-trimmed tabs.
class KanzenApp extends StatefulWidget {
  final Session session;
  final int initialTab;
  KanzenApp({super.key, required this.session})
      : initialTab = int.tryParse(Uri.base.queryParameters['tab'] ?? '') ?? 0;

  @override
  State<KanzenApp> createState() => _KanzenAppState();
}

class _KanzenAppState extends State<KanzenApp> {
  @override
  void initState() {
    super.initState();
    if (widget.session.status == AuthStatus.loading) widget.session.bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kanzen',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: K.bg,
        colorScheme: ColorScheme.fromSeed(seedColor: K.accent),
        navigationBarTheme:
            const NavigationBarThemeData(backgroundColor: K.bgElev),
      ),
      home: SessionScope(
        session: widget.session,
        child: ListenableBuilder(
          listenable: widget.session,
          builder: (context, _) {
            switch (widget.session.status) {
              case AuthStatus.loading:
                return const _Splash();
              case AuthStatus.signedOut:
                return LoginScreen(widget.session);
              case AuthStatus.signedIn:
                return HomeShell(initialTab: widget.initialTab);
            }
          },
        ),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: K.bg,
        body: Center(child: CircularProgressIndicator(color: K.accent)),
      );
}

/// One bottom-nav entry: its destination chrome, the screen, and the permission
/// that must be held to even see the tab (server still enforces every read).
class _Tab {
  final String label;
  final IconData icon;
  final IconData? selectedIcon;
  final Widget screen;
  final bool Function(Session)? gate;
  const _Tab(this.label, this.icon, this.screen,
      {this.selectedIcon, this.gate});
}

class HomeShell extends StatefulWidget {
  final int initialTab;
  const HomeShell({super.key, this.initialTab = 0});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = widget.initialTab;

  // The full tab set, in order. Inventory (assets) and Money (finance) are
  // Principal/Manager surfaces — Staff like Marcia/Siti never see them (AC1/AC7),
  // matching how the web nav recalibrates via can().
  static const _allTabs = <_Tab>[
    _Tab('Home', Icons.home_outlined, DashboardScreen(),
        selectedIcon: Icons.home),
    _Tab('Inventory', Icons.inventory_2_outlined, InventoryScreen(),
        gate: _canAssets),
    _Tab('Properties', Icons.home_work_outlined, PropertiesScreen()),
    _Tab('People', Icons.people_outline, PeopleScreen()),
    _Tab('Money', Icons.account_balance_wallet_outlined, FinanceScreen(),
        gate: _canFinance),
    _Tab('Triage', Icons.inbox_outlined, TriageScreen(),
        selectedIcon: Icons.inbox),
  ];

  static bool _canAssets(Session s) => s.can('asset');
  static bool _canFinance(Session s) => s.can('bill') || s.can('expense');

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final tabs = _allTabs.where((t) => t.gate == null || t.gate!(s)).toList();
    final index = _index.clamp(0, tabs.length - 1);

    return Scaffold(
      backgroundColor: K.bg,
      body: IndexedStack(
          index: index, children: [for (final t in tabs) t.screen]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in tabs)
            NavigationDestination(
              icon: Icon(t.icon),
              selectedIcon: Icon(t.selectedIcon ?? t.icon),
              label: t.label,
            ),
        ],
      ),
    );
  }
}
