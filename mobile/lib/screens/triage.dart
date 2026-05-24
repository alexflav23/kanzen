import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/mock_data.dart';
import '../widgets/pill.dart';

/// F31 capture-first companion — the Triage screen is the mobile app's reason to exist:
/// capture a receipt/document on the go (the prominent FAB), and review the agent's proposed
/// actions (F26). Financial/asset items are marked "Review" — never auto-committed (F27).
class TriageScreen extends StatefulWidget {
  const TriageScreen({super.key});
  @override
  State<TriageScreen> createState() => _TriageScreenState();
}

class _TriageScreenState extends State<TriageScreen> {
  final List<TriageItem> _items = [...seedTriage];
  int _captureSeq = 0;

  void _capture() => setState(() {
        _captureSeq += 1;
        _items.insert(0, TriageItem('cap$_captureSeq', 'Captured receipt · pending parse', 'Receipt', 'camera'));
      });

  void _resolve(String id) => setState(() => _items.removeWhere((t) => t.id == id));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: K.bg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _capture,
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
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: K.ink, letterSpacing: -0.5)),
            const SizedBox(height: 4),
            Text('${_items.length} item${_items.length == 1 ? '' : 's'} to review',
                style: const TextStyle(fontSize: 14, color: K.ink2)),
            const SizedBox(height: 16),
            if (_items.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: K.card,
                child: const Text('All clear — nothing to triage.', style: TextStyle(color: K.ink3)),
              ),
            for (final t in _items)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: K.card,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Pill(t.category, tone: t.locked ? PillTone.warn : PillTone.accent),
                      const SizedBox(width: 8),
                      if (t.locked) const Pill('Review', tone: PillTone.warn),
                    ]),
                    const SizedBox(height: 8),
                    Text(t.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: K.ink)),
                    Text(t.source, style: const TextStyle(fontSize: 12, color: K.ink3)),
                    const SizedBox(height: 8),
                    Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                      TextButton.icon(
                        onPressed: () => _resolve(t.id),
                        icon: const Icon(Icons.close, size: 18, color: K.ink3),
                        label: const Text('Reject', style: TextStyle(color: K.ink3)),
                      ),
                      const SizedBox(width: 4),
                      FilledButton.icon(
                        onPressed: () => _resolve(t.id),
                        style: FilledButton.styleFrom(backgroundColor: K.accent, foregroundColor: K.accentInk),
                        icon: const Icon(Icons.check, size: 18),
                        label: Text(t.locked ? 'Confirm (review)' : 'Confirm'),
                      ),
                    ]),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
