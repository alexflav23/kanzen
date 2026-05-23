import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/pill.dart';

/// Mirrors web Dashboard.tsx — the "Good morning." greeting + foundation pills.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          Row(children: [
            Pill('Foundation', tone: PillTone.accent),
            SizedBox(width: 8),
            Pill('F00 · design system'),
          ]),
          SizedBox(height: 16),
          Text('Good morning.',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: K.ink, letterSpacing: -0.5)),
          SizedBox(height: 8),
          Text('Kanzen companion — the StyleX design system, on mobile.',
              style: TextStyle(fontSize: 14, color: K.ink2)),
        ],
      ),
    );
  }
}
