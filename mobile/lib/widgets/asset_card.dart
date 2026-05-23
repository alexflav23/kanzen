import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme.dart';

/// Mirrors web AssetCard.tsx — maker · title · valuation.
class AssetCard extends StatelessWidget {
  final Asset asset;
  const AssetCard(this.asset, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: K.card,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(asset.maker, style: const TextStyle(fontSize: 11, color: K.ink3)),
          const SizedBox(height: 2),
          Text(asset.title,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: K.ink)),
          const SizedBox(height: 6),
          Text(pounds(asset.valueGbp),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: K.ink)),
        ],
      ),
    );
  }
}
