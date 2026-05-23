import 'package:flutter/material.dart';

void main() => runApp(const KanzenApp());

/// F31 — Kanzen companion. Capture-first shell with the bottom tab bar
/// (Home · Triage · Bibles · Money · Search), mirroring SPEC §16.8 / App. E.18.
class KanzenApp extends StatelessWidget {
  const KanzenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kanzen',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: const Color(0xFF4F46E5)),
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  static const _tabs = ['Home', 'Triage', 'Bibles', 'Money', 'Search'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text(
          _index == 0 ? 'Good morning' : _tabs[_index],
          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.inbox_outlined), label: 'Triage'),
          NavigationDestination(icon: Icon(Icons.home_work_outlined), label: 'Bibles'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Money'),
          NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
        ],
      ),
    );
  }
}
