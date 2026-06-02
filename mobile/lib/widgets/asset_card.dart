import 'package:flutter/material.dart';
import '../api/models.dart';
import '../theme.dart';

/// Mirrors web AssetCard.tsx — maker · title · acquisition value (money is
/// integer minor units + ISO currency; never a float).
class AssetCard extends StatelessWidget {
  final Asset asset;
  const AssetCard(this.asset, {super.key});

  @override
  Widget build(BuildContext context) {
    final cost = asset.acquisitionCostMinor;
    final value =
        cost == null ? '—' : money(cost, asset.acquisitionCurrency ?? 'GBP');
    return Container(
      decoration: K.card,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if ((asset.maker ?? '').isNotEmpty)
            Text(asset.maker!,
                style: const TextStyle(fontSize: 11, color: K.ink3)),
          const SizedBox(height: 2),
          Text(asset.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w500, color: K.ink)),
          const SizedBox(height: 6),
          Text(value,
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600, color: K.ink)),
        ],
      ),
    );
  }
}
