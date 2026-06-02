import 'package:flutter/material.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/pill.dart';

/// Mirrors web Properties.tsx — property cards with the rooms/assets/bills/vendors
/// stats grid (GET /api/properties, authz-filtered to the principal's scope).
class PropertiesScreen extends StatefulWidget {
  const PropertiesScreen({super.key});
  @override
  State<PropertiesScreen> createState() => _PropertiesScreenState();
}

class _PropertiesScreenState extends State<PropertiesScreen> {
  Future<List<Property>>? _future;

  Future<List<Property>> _load() => SessionScope.of(context).api.properties();

  @override
  Widget build(BuildContext context) {
    _future ??= _load();
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Properties',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: K.ink,
                  letterSpacing: -0.5)),
          const SizedBox(height: 16),
          AsyncView<List<Property>>(
            future: _future!,
            onRetry: () => setState(() {
              _future = _load();
            }),
            builder: (context, properties) {
              if (properties.isEmpty) {
                return const EmptyCard('No properties in scope yet.');
              }
              return Column(
                children: [
                  for (final p in properties) ...[
                    _card(p),
                    const SizedBox(height: 16)
                  ]
                ],
              );
            },
          ),
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
                      style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: K.ink)),
                ),
                if ((p.jurisdiction ?? '').isNotEmpty) Pill(p.jurisdiction!),
              ],
            ),
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
            Text('$n',
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w600, color: K.ink)),
            Text(label, style: const TextStyle(fontSize: 11, color: K.ink3)),
          ],
        ),
      );
}
