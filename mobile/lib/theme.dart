import 'package:flutter/material.dart';

/// F00 design tokens — warm-paper light theme, single indigo accent (SPEC §16),
/// ported 1:1 from the web tokens (web/src/styles/tokens.stylex.ts) so the
/// mobile companion is visually at parity with the web app.
class K {
  static const bg = Color(0xFFFAF8F5);
  static const bgElev = Color(0xFFFFFFFF);
  static const bgSunken = Color(0xFFF2EFE9);
  static const ink = Color(0xFF1A1A1A);
  static const ink2 = Color(0xFF3A3A3A);
  static const ink3 = Color(0xFF6B6B6B);
  static const line = Color(0xFFE7E3DC);
  static const accent = Color(0xFF4F46E5);
  static const accentSoft = Color(0xFFEEF2FF);
  static const accentInk = Color(0xFFFFFFFF);
  static const positive = Color(0xFF15803D);
  static const warn = Color(0xFFB45309);
  static const warnSoft = Color(0xFFFFF7ED);
  static const danger = Color(0xFFB91C1C);

  static BoxDecoration get card => BoxDecoration(
        color: bgElev,
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(14),
      );
}

String _group(int n) =>
    n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

/// Money in integer minor units → display, matching the web's en-GB formatting:
/// GBP renders with the £ symbol, other currencies with the ISO code prefix.
String money(int minor, String currency) {
  final whole = (minor / 100).round();
  if (currency == 'GBP') return '£${_group(whole)}';
  if (currency == 'SGD') return 'S\$${_group(whole)}'; // design style, matches web
  return '$currency ${_group(whole)}';
}

/// Whole-pound value (asset valuations are already in pounds).
String pounds(int whole) => '£${_group(whole)}';
