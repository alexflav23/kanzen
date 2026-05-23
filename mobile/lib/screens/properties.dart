import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme.dart';
import '../widgets/pill.dart';

/// Mirrors web Properties.tsx — property cards with the stats grid.
class PropertiesScreen extends StatelessWidget {
  const PropertiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Properties',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: K.ink, letterSpacing: -0.5)),
          const SizedBox(height: 16),
          for (final p in properties) ...[_card(p), const SizedBox(height: 16)],
        ],
      ),
    );
  }

  Widget _card(Property p) => Container(
        decoration: K.card,
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(p.name,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: K.ink)),
                ),
                Pill(p.jurisdiction),
              ],
            ),
            Text(p.address, style: const TextStyle(fontSize: 13, color: K.ink3)),
            const SizedBox(height: 12),
            Row(children: [
              _stat(p.rooms, 'Rooms'),
              _stat(p.assets, 'Assets'),
              _stat(p.bills, 'Bills'),
              _stat(p.vendors, 'Vendors'),
            ]),
          ],
        ),
      );

  Widget _stat(int n, String label) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$n', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: K.ink)),
            Text(label, style: const TextStyle(fontSize: 11, color: K.ink3)),
          ],
        ),
      );
}
