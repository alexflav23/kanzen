import 'package:flutter/material.dart';
import 'theme.dart';
import 'screens/dashboard.dart';
import 'screens/inventory.dart';
import 'screens/finance.dart';
import 'screens/properties.dart';
import 'screens/people.dart';
import 'screens/triage.dart';

void main() {
  // Deep-link the initial tab via ?tab=N (used for per-screen web screenshots);
  // defaults to 0 everywhere else.
  final tab = int.tryParse(Uri.base.queryParameters['tab'] ?? '') ?? 0;
  runApp(KanzenApp(initialTab: tab));
}

/// F31 — Kanzen companion. At feature parity with the web app: the same five
/// built features (Dashboard · Inventory · Properties · People · Finance), the
/// same seed data and the same warm-paper design tokens. The prototype's
/// capture-first tabs (Triage/Bibles/Search) map to web nav items that are also
/// "Coming soon", so both platforms surface the same built set.
class KanzenApp extends StatelessWidget {
  final int initialTab;
  const KanzenApp({super.key, this.initialTab = 0});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kanzen',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: K.bg,
        colorScheme: ColorScheme.fromSeed(seedColor: K.accent),
        navigationBarTheme: const NavigationBarThemeData(backgroundColor: K.bgElev),
      ),
      home: HomeShell(initialTab: initialTab),
    );
  }
}

class HomeShell extends StatefulWidget {
  final int initialTab;
  const HomeShell({super.key, this.initialTab = 0});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = widget.initialTab.clamp(0, 5);

  static const _screens = <Widget>[
    DashboardScreen(),
    InventoryScreen(),
    PropertiesScreen(),
    PeopleScreen(),
    FinanceScreen(),
    TriageScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: K.bg,
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), label: 'Inventory'),
          NavigationDestination(icon: Icon(Icons.home_work_outlined), label: 'Properties'),
          NavigationDestination(icon: Icon(Icons.people_outline), label: 'People'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Money'),
          NavigationDestination(icon: Icon(Icons.inbox_outlined), selectedIcon: Icon(Icons.inbox), label: 'Triage'),
        ],
      ),
    );
  }
}
