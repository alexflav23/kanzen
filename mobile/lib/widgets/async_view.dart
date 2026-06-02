import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../theme.dart';

/// Renders the four states every data-backed screen must show (DoD): loading,
/// error, forbidden (403 — out of role/scope), and the loaded data. Empty is the
/// builder's concern (it knows what "no rows" looks like). One place so every
/// screen behaves identically and matches the calm design language.
class AsyncView<T> extends StatelessWidget {
  final Future<T> future;
  final Widget Function(BuildContext, T) builder;
  final VoidCallback? onRetry;
  const AsyncView(
      {super.key, required this.future, required this.builder, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.only(top: 48),
            child: Center(child: CircularProgressIndicator(color: K.accent)),
          );
        }
        if (snap.hasError) {
          final e = snap.error;
          if (e is ApiException && e.forbidden) {
            return const _State(
              icon: Icons.lock_outline,
              title: 'No access',
              body: "You don't have permission to view this here.",
            );
          }
          final msg = e is ApiException ? e.detail : 'Something went wrong.';
          return _State(
            icon: Icons.cloud_off_outlined,
            title: 'Could not load',
            body: msg,
            onRetry: onRetry,
          );
        }
        return builder(context, snap.data as T);
      },
    );
  }
}

/// A calm empty-state card (the builder shows this when there are no rows).
class EmptyCard extends StatelessWidget {
  final String text;
  const EmptyCard(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: K.card,
        child: Text(text, style: const TextStyle(color: K.ink3)),
      );
}

class _State extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final VoidCallback? onRetry;
  const _State(
      {required this.icon,
      required this.title,
      required this.body,
      this.onRetry});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 40),
        child: Column(
          children: [
            Icon(icon, size: 36, color: K.ink3),
            const SizedBox(height: 12),
            Text(title,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600, color: K.ink)),
            const SizedBox(height: 4),
            Text(body,
                textAlign: TextAlign.center,
                style: const TextStyle(color: K.ink3, fontSize: 13)),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onRetry,
                style: FilledButton.styleFrom(
                    backgroundColor: K.accent, foregroundColor: K.accentInk),
                child: const Text('Retry'),
              ),
            ],
          ],
        ),
      );
}
