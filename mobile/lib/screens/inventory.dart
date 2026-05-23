import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme.dart';
import '../widgets/asset_card.dart';

/// Mirrors web Inventory.tsx — asset grid with category filter chips.
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});
  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  String _cat = 'All';

  @override
  Widget build(BuildContext context) {
    final shown = _cat == 'All' ? assets : assets.where((a) => a.category == _cat).toList();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Inventory',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: K.ink, letterSpacing: -0.5)),
            const SizedBox(height: 16),
            Wrap(spacing: 6, runSpacing: 6, children: [for (final c in categories) _chip(c)]),
            const SizedBox(height: 16),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 1.5,
                children: [for (final a in shown) AssetCard(a)],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String c) {
    final active = c == _cat;
    return Semantics(
      button: true,
      selected: active,
      child: GestureDetector(
        onTap: () => setState(() => _cat = c),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: active ? K.accent : K.bgElev,
            border: Border.all(color: active ? K.accent : K.line),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(c, style: TextStyle(fontSize: 13, color: active ? K.accentInk : K.ink2)),
        ),
      ),
    );
  }
}
