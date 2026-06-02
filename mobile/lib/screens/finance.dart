import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets/async_view.dart';

/// Mirrors web Finance.tsx — the approvals queue (approve/reject) over the live
/// expense ledger (GET /api/expenses; Manager+/Principal — Staff get a 403).
/// Kanzen never moves money: approve/reject record the decision only (F17).
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});
  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  Future<List<Expense>>? _future;
  bool _busy = false;

  Future<List<Expense>> _load() => SessionScope.of(context).api.expenses();

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
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Bills, expenses & budgets',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: K.ink,
                  letterSpacing: -0.5)),
          const SizedBox(height: 4),
          AsyncView<List<Expense>>(
            future: _future!,
            onRetry: () => setState(() {
              _future = _load();
            }),
            builder: (context, expenses) {
              final pending = expenses.where((e) => e.pending).toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${pending.length} pending your approval.',
                      style: const TextStyle(color: K.ink3)),
                  _section('AWAITING YOUR APPROVAL'),
                  if (pending.isEmpty)
                    const Text('Nothing awaiting approval.',
                        style: TextStyle(color: K.ink3, fontSize: 13))
                  else
                    for (final e in pending)
                      _rowShell([
                        Expanded(
                            child: Text(e.payee ?? 'Expense',
                                overflow: TextOverflow.ellipsis)),
                        Text(money(e.amountMinor, e.currency),
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(width: 10),
                        _btn('Reject',
                            () => _act(() => api.rejectExpense(e.id))),
                        const SizedBox(width: 6),
                        _btn('Approve',
                            () => _act(() => api.approveExpense(e.id)),
                            primary: true),
                      ]),
                  _section('ALL EXPENSES'),
                  if (expenses.isEmpty)
                    const EmptyCard('No expenses recorded yet.')
                  else
                    for (final e in expenses)
                      _rowShell([
                        Expanded(
                            child: Text(e.payee ?? 'Expense',
                                overflow: TextOverflow.ellipsis)),
                        Text(e.status.replaceAll('_', ' '),
                            style:
                                const TextStyle(color: K.ink3, fontSize: 13)),
                        const SizedBox(width: 10),
                        Text(money(e.amountMinor, e.currency),
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                      ]),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _section(String label) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 18, 0, 8),
        child: Text(label,
            style: const TextStyle(
                fontSize: 11,
                letterSpacing: 0.8,
                color: K.ink3,
                fontWeight: FontWeight.w600)),
      );

  Widget _rowShell(List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: K.card,
        child: Row(children: children),
      );

  Widget _btn(String label, VoidCallback onTap, {bool primary = false}) =>
      GestureDetector(
        onTap: _busy ? null : onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: primary ? K.accent : K.bgElev,
            border: Border.all(color: primary ? K.accent : K.line),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 13, color: primary ? K.accentInk : K.ink2)),
        ),
      );
}
