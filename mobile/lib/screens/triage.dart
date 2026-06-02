import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/kanzen_api.dart';
import '../api/models.dart';
import '../capture/capture_source.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/pill.dart';

/// F31 capture-first — the Triage screen is the mobile app's reason to exist:
/// capture on the go (the prominent FAB → [CaptureSource]) and review the agent's
/// proposed actions (GET /api/agent/actions). Financial/asset items are marked
/// "Review" and require an explicit confirm — never auto-committed (F27).
class TriageScreen extends StatefulWidget {
  /// Injectable so widget tests can drive capture without a camera/sheet.
  final CaptureSource capture;
  const TriageScreen({super.key, this.capture = const StubCaptureSource()});
  @override
  State<TriageScreen> createState() => _TriageScreenState();
}

class _TriageScreenState extends State<TriageScreen> {
  Future<List<AgentAction>>? _future;
  bool _busy = false;

  Future<List<AgentAction>> _load() =>
      SessionScope.of(context).api.agentActions();

  Future<void> _act(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) {
        setState(() {
          _future = _load();
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.detail)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    _future ??= _load();
    final api = SessionScope.of(context).api;
    return Scaffold(
      backgroundColor: K.bg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => widget.capture.capture(context),
        backgroundColor: K.accent,
        foregroundColor: K.accentInk,
        icon: const Icon(Icons.camera_alt_outlined),
        label: const Text('Capture'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Text('Triage',
                style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w600,
                    color: K.ink,
                    letterSpacing: -0.5)),
            const SizedBox(height: 4),
            AsyncView<List<AgentAction>>(
              future: _future!,
              onRetry: () => setState(() {
                _future = _load();
              }),
              builder: (context, items) {
                if (items.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: EmptyCard('All clear — nothing to triage.'),
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                        '${items.length} item${items.length == 1 ? '' : 's'} to review',
                        style: const TextStyle(fontSize: 14, color: K.ink2)),
                    const SizedBox(height: 12),
                    for (final t in items) _card(t, api),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(AgentAction t, KanzenApi api) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: K.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Pill(t.category ?? t.actionType,
                  tone: t.locked ? PillTone.warn : PillTone.accent),
              const SizedBox(width: 8),
              if (t.locked) const Pill('Review', tone: PillTone.warn),
            ]),
            const SizedBox(height: 8),
            Text(t.subject ?? t.actionType,
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600, color: K.ink)),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              TextButton.icon(
                onPressed: () => _act(() => api.rejectAction(t.id)),
                icon: const Icon(Icons.close, size: 18, color: K.ink3),
                label: const Text('Reject', style: TextStyle(color: K.ink3)),
              ),
              const SizedBox(width: 4),
              FilledButton.icon(
                onPressed: () => _act(() => api.confirmAction(t.id)),
                style: FilledButton.styleFrom(
                    backgroundColor: K.accent, foregroundColor: K.accentInk),
                icon: const Icon(Icons.check, size: 18),
                label: Text(t.locked ? 'Confirm (review)' : 'Confirm'),
              ),
            ]),
          ],
        ),
      );
}
