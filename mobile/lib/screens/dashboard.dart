import 'package:flutter/material.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/pill.dart';

/// Mirrors web Dashboard.tsx — the greeting + live foundation stats (GET /api/dashboard),
/// scope-filtered server-side (Staff see no assets; Manager sees no registry assets).
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Future<Summary>? _future;

  Future<Summary> _load() => SessionScope.of(context).api.dashboard();

  @override
  Widget build(BuildContext context) {
    _future ??= _load();
    final me = SessionScope.of(context).me;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(children: [
            const Pill('Foundation', tone: PillTone.accent),
            const SizedBox(width: 8),
            if (me != null) Pill(me.role),
          ]),
          const SizedBox(height: 16),
          const Text('Good morning.',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: K.ink,
                  letterSpacing: -0.5)),
          const SizedBox(height: 8),
          Text(me == null ? 'Kanzen companion.' : 'Welcome back, ${me.name}.',
              style: const TextStyle(fontSize: 14, color: K.ink2)),
          const SizedBox(height: 20),
          AsyncView<Summary>(
            future: _future!,
            onRetry: () => setState(() {
              _future = _load();
            }),
            builder: (context, s) => Column(
              children: [
                Row(children: [
                  _stat('${s.pendingApprovals}', 'Pending approvals',
                      warn: s.pendingApprovals > 0),
                  const SizedBox(width: 12),
                  _stat('${s.properties}', 'Properties'),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  _stat('${s.assets}', 'Assets'),
                  const SizedBox(width: 12),
                  _stat('${s.expiringPermits}', 'Permits expiring',
                      warn: s.expiringPermits > 0),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String value, String label, {bool warn = false}) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: K.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w600,
                      color: warn ? K.warn : K.ink)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 12, color: K.ink3)),
            ],
          ),
        ),
      );
}
