import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useRef } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { X, ChevronRight, Trash } from "./icons";

const styles = stylex.create({
  overlay: { position: "fixed", inset: 0, zIndex: 100, backgroundColor: colors.scrimHeavy, display: "grid", gridTemplateRows: "auto 1fr auto", padding: "16px" },
  bar: { display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff" },
  caption: { fontSize: "13.5px", fontWeight: 500, opacity: 0.95, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  counter: { fontSize: "12px", opacity: 0.7, fontVariantNumeric: "tabular-nums", marginLeft: "10px", flexShrink: 0 },
  actions: { display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  stage: { position: "relative", display: "grid", placeItems: "center", minHeight: 0 },
  img: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: radius.sm, display: "block" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: radius.pill, border: 0, backgroundColor: "rgba(255,255,255,.12)", color: "#fff", cursor: "pointer" },
  nav: { position: "absolute", top: "50%", transform: "translateY(-50%)", width: "44px", height: "44px", borderRadius: radius.pill, border: 0, backgroundColor: "rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  prev: { left: "8px", transform: "translateY(-50%) rotate(180deg)" },
  next: { right: "8px" },
  foot: { height: "8px" },
});

/** A full-screen image viewer (lightbox): large image, prev/next, Esc/click-backdrop to close,
 * focus-trapped + keyboard-navigable. `index` is the open photo; null = closed. */
export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
  onDelete,
}: {
  photos: { id: string; url: string; name: string }[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
  onDelete?: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = index != null && index >= 0 && index < photos.length;
  const go = useCallback(
    (delta: number) => { if (index != null) onIndex((index + delta + photos.length) % photos.length); },
    [index, photos.length, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        // simple focus trap: keep focus inside the dialog
        const f = dialogRef.current?.querySelectorAll<HTMLElement>("button");
        if (f && f.length) {
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, go, onClose]);

  if (!open) return null;
  const photo = photos[index!];
  return (
    <div
      {...stylex.props(styles.overlay)}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo viewer — ${photo.name}`}
      data-testid="lightbox"
      ref={dialogRef}
      tabIndex={-1}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div {...stylex.props(styles.bar)}>
        <span {...stylex.props(styles.caption)}>{photo.name}<span {...stylex.props(styles.counter)}>{index! + 1} / {photos.length}</span></span>
        <span {...stylex.props(styles.actions)}>
          {onDelete && (
            <button type="button" {...stylex.props(styles.iconBtn)} aria-label={`Delete photo ${photo.name}`} onClick={() => onDelete(photo.id)}><Trash size={17} /></button>
          )}
          <button type="button" {...stylex.props(styles.iconBtn)} aria-label="Close viewer" onClick={onClose}><X size={18} /></button>
        </span>
      </div>
      <div {...stylex.props(styles.stage)}>
        <img {...stylex.props(styles.img)} src={photo.url} alt={photo.name} data-testid="lightbox-image" />
        {photos.length > 1 && (
          <>
            <button type="button" {...stylex.props(styles.nav, styles.prev)} aria-label="Previous photo" onClick={() => go(-1)}><ChevronRight size={20} /></button>
            <button type="button" {...stylex.props(styles.nav, styles.next)} aria-label="Next photo" onClick={() => go(1)}><ChevronRight size={20} /></button>
          </>
        )}
      </div>
      <div {...stylex.props(styles.foot)} />
    </div>
  );
}
