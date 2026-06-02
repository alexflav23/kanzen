import 'package:flutter/material.dart';
import '../theme.dart';

/// The capture seam (F31 capture-first). Mirrors the backend's Stub→real-client
/// pattern: the UI calls [CaptureSource.capture]; the sandbox ships
/// [StubCaptureSource], and the real device implementation drops in behind the
/// same interface with no change to the Triage screen.
///
/// The live `CameraCaptureSource` (operator/device-gated, per SETUP.md) is:
///   image_picker → POST /api/documents (immutable original to S3, F05)
///     → POST /api/receipts (OCR + classify, F13) → a proposed agent action
///     surfaces here in Triage for review (F26). Nothing auto-commits (F27).
abstract class CaptureSource {
  Future<void> capture(BuildContext context);
}

/// Sandbox capture: there is no camera/S3/OCR here, so explain — honestly —
/// exactly what the device build wires up. Keeps the FAB live and the flow
/// discoverable without faking a committed record.
class StubCaptureSource implements CaptureSource {
  const StubCaptureSource();

  @override
  Future<void> capture(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: K.bgElev,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.camera_alt_outlined, color: K.accent, size: 30),
            const SizedBox(height: 12),
            const Text('Capture',
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w600, color: K.ink)),
            const SizedBox(height: 8),
            const Text(
              'On a device, the camera uploads the photo to S3 (the immutable '
              'original), the agent runs OCR + classification, and its proposal '
              'appears below in Triage for you to review — nothing is committed '
              'until you confirm.',
              style: TextStyle(color: K.ink3, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 18),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                style: FilledButton.styleFrom(
                    backgroundColor: K.accent, foregroundColor: K.accentInk),
                child: const Text('Got it'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
