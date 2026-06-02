import 'package:flutter/material.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/asset_card.dart';

/// Mirrors web Inventory.tsx — the asset grid (GET /api/assets). Principal-private
/// with the Manager carve-out; Staff get a 403 → the forbidden state (and never
/// see the tab in the first place).
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});
  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  Future<List<Asset>>? _future;

  Future<List<Asset>> _load() => SessionScope.of(context).api.assets();

  @override
  Widget build(BuildContext context) {
    _future ??= _load();
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Inventory',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: K.ink,
                  letterSpacing: -0.5)),
          const SizedBox(height: 16),
          AsyncView<List<Asset>>(
            future: _future!,
            onRetry: () => setState(() {
              _future = _load();
            }),
            builder: (context, assets) {
              if (assets.isEmpty) {
                return const EmptyCard('No assets in scope yet.');
              }
              return GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 1.5,
                children: [for (final a in assets) AssetCard(a)],
              );
            },
          ),
        ],
      ),
    );
  }
}
