import 'package:flutter/material.dart';
import '../state/session.dart';
import '../theme.dart';

/// Sign-in. In the sandbox this is the persona switcher (the backend mints a
/// local JWT via /api/dev/token), mirroring the web DevLogin. The real Cognito
/// hosted-UI sign-in drops in behind the same `Session.signInDev -> token`
/// seam — swap this screen's tap handler for the Cognito redirect; everything
/// downstream (token storage, /api/me, role gating) is unchanged.
class LoginScreen extends StatefulWidget {
  final Session session;
  const LoginScreen(this.session, {super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String? _busyEmail;

  Future<void> _signIn(Persona p) async {
    setState(() => _busyEmail = p.email);
    await widget.session.signInDev(p);
    if (mounted) setState(() => _busyEmail = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: K.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('完',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 44,
                        color: K.accent,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                const Text('Kanzen',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w600,
                        color: K.ink,
                        letterSpacing: -0.5)),
                const SizedBox(height: 4),
                const Text('Companion — sign in to continue',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: K.ink3, fontSize: 14)),
                const SizedBox(height: 28),
                for (final p in kPersonas) _personaTile(p),
                if (widget.session.error != null) ...[
                  const SizedBox(height: 12),
                  Text(widget.session.error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: K.danger, fontSize: 13)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _personaTile(Persona p) {
    final busy = _busyEmail == p.email;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: _busyEmail == null ? () => _signIn(p) : null,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: K.card,
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: K.accentSoft,
                child: Text(p.name[0],
                    style: const TextStyle(
                        color: K.accent, fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: K.ink,
                            fontSize: 15)),
                    Text(p.role,
                        style: const TextStyle(color: K.ink3, fontSize: 12)),
                  ],
                ),
              ),
              if (busy)
                const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: K.accent))
              else
                const Icon(Icons.chevron_right, color: K.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
