import 'package:flutter/material.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/pill.dart';

/// Mirrors web People.tsx — the team directory with the expiring-permit warning
/// (GET /api/people). Staff see only themselves; Manager/Principal see the
/// property-scoped roster — all enforced server-side.
class PeopleScreen extends StatefulWidget {
  const PeopleScreen({super.key});
  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  Future<List<Person>>? _future;

  Future<List<Person>> _load() => SessionScope.of(context).api.people();

  @override
  Widget build(BuildContext context) {
    _future ??= _load();
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('People',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: K.ink,
                  letterSpacing: -0.5)),
          const SizedBox(height: 16),
          AsyncView<List<Person>>(
            future: _future!,
            onRetry: () => setState(() {
              _future = _load();
            }),
            builder: (context, people) {
              if (people.isEmpty) {
                return const EmptyCard('No team members in scope yet.');
              }
              return Column(children: [for (final p in people) _row(p)]);
            },
          ),
        ],
      ),
    );
  }

  Widget _row(Person p) {
    final days = p.permitDays;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: K.card,
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
                color: K.accentSoft, shape: BoxShape.circle),
            child: Text(p.name.isEmpty ? '?' : p.name[0],
                style: const TextStyle(
                    color: K.accent,
                    fontWeight: FontWeight.w600,
                    fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w500, color: K.ink)),
                if ((p.role ?? '').isNotEmpty)
                  Text(p.role!,
                      style: const TextStyle(fontSize: 13, color: K.ink3)),
              ],
            ),
          ),
          if (days != null && days < 90)
            Pill('Work permit · ${days}d', tone: PillTone.warn),
        ],
      ),
    );
  }
}
