import 'package:flutter/material.dart';
import '../theme.dart';

enum PillTone { neutral, accent, warn }

/// F00 design-system component — token-driven pill (mirrors web Pill.tsx).
class Pill extends StatelessWidget {
  final String label;
  final PillTone tone;
  const Pill(this.label, {super.key, this.tone = PillTone.neutral});

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (tone) {
      PillTone.accent => (K.accentSoft, K.accent),
      PillTone.warn => (K.warnSoft, K.warn),
      PillTone.neutral => (K.bgSunken, K.ink2),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label,
          style:
              TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w500)),
    );
  }
}
