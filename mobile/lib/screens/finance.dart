import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme.dart';

/// Mirrors web Finance.tsx — the approvals queue (approve/reject) + ledger.
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});
  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  late List<Expense> _items = List.of(expenses);

  void _decide(String id, ExpenseStatus s) =>
      setState(() => _items = [for (final e in _items) e.id == id ? e.withStatus(s) : e]);

  @override
  Widget build(BuildContext context) {
    final pending = _items.where((e) => e.status == ExpenseStatus.pending).toList();
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Bills, expenses & budgets',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: K.ink, letterSpacing: -0.5)),
          const SizedBox(height: 4),
          Text('${pending.length} pending your approval.', style: const TextStyle(color: K.ink3)),
          _section('AWAITING YOUR APPROVAL'),
          if (pending.isEmpty)
            const Text('Nothing awaiting approval.', style: TextStyle(color: K.ink3, fontSize: 13))
          else
            ...pending.map(_pendingRow),
          _section('ALL EXPENSES'),
          ..._items.map(_ledgerRow),
        ],
      ),
    );
  }

  Widget _section(String label) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 18, 0, 8),
        child: Text(label,
            style: const TextStyle(fontSize: 11, letterSpacing: 0.8, color: K.ink3, fontWeight: FontWeight.w600)),
      );

  Widget _rowShell(List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: K.card,
        child: Row(children: children),
      );

  Widget _pendingRow(Expense e) => _rowShell([
        Expanded(child: Text('${e.description} · ${e.payee} · ${e.property}', overflow: TextOverflow.ellipsis)),
        Text(money(e.amountMinor, e.currency), style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(width: 10),
        _btn('Reject', () => _decide(e.id, ExpenseStatus.rejected)),
        const SizedBox(width: 6),
        _btn('Approve', () => _decide(e.id, ExpenseStatus.approved), primary: true),
      ]);

  Widget _ledgerRow(Expense e) => _rowShell([
        Expanded(child: Text('${e.description} · ${e.payee}', overflow: TextOverflow.ellipsis)),
        Text(e.status.name, style: const TextStyle(color: K.ink3, fontSize: 13)),
        const SizedBox(width: 10),
        Text(money(e.amountMinor, e.currency), style: const TextStyle(fontWeight: FontWeight.w600)),
      ]);

  Widget _btn(String label, VoidCallback onTap, {bool primary = false}) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: primary ? K.accent : K.bgElev,
            border: Border.all(color: primary ? K.accent : K.line),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(label, style: TextStyle(fontSize: 13, color: primary ? K.accentInk : K.ink2)),
        ),
      );
}
