import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme.dart';
import '../widgets/pill.dart';

/// Mirrors web People.tsx — the team directory with the expiring-permit warning.
class PeopleScreen extends StatelessWidget {
  const PeopleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('People',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: K.ink, letterSpacing: -0.5)),
          const SizedBox(height: 16),
          for (final p in people) _row(p),
        ],
      ),
    );
  }

  Widget _row(Person p) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: K.card,
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: K.accentSoft, shape: BoxShape.circle),
              child: Text(p.name[0],
                  style: const TextStyle(color: K.accent, fontWeight: FontWeight.w600, fontSize: 13)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.name, style: const TextStyle(fontWeight: FontWeight.w500, color: K.ink)),
                  Text(p.role, style: const TextStyle(fontSize: 13, color: K.ink3)),
                ],
              ),
            ),
            if (p.permitDays != null && p.permitDays! < 90)
              Pill('Work permit · ${p.permitDays}d', tone: PillTone.warn),
          ],
        ),
      );
}
