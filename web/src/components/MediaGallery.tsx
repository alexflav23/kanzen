import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Plus, Trash, Image, Star, StarFill } from "./icons";
import { Lightbox } from "./Lightbox";
import { documentsFor, removePhoto, uploadAndLink } from "../services/documents";
import { useAuth } from "../state/AuthContext";

const styles = stylex.create({
  wrap: { display: "flex", flexDirection: "column", gap: "8px" },
  grid: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" },
  thumb: { position: "relative", width: "64px", height: "64px", borderRadius: radius.sm, overflow: "hidden", border: `1px solid ${colors.line}`, backgroundColor: colors.bgSunken, flexShrink: 0 },
  viewBtn: { display: "block", width: "100%", height: "100%", padding: 0, border: 0, background: "transparent", cursor: "zoom-in" },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  remove: { position: "absolute", top: "3px", right: "3px", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "999px", border: 0, backgroundColor: colors.scrim, color: "#fff", cursor: "pointer", opacity: 0, transition: "opacity .12s ease" },
  hero: { position: "absolute", top: "3px", left: "3px", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "999px", border: 0, backgroundColor: colors.scrim, color: "#fff", cursor: "pointer", opacity: 0, transition: "opacity .12s ease" },
  heroOn: { opacity: 1, backgroundColor: colors.accent, color: colors.accentInk },
  // dynamic via :hover would need a parent selector; reveal the remove control on thumb hover
  thumbHover: { ":hover": {} },
  dropTile: { width: "64px", height: "64px", borderRadius: radius.sm, border: `1.5px dashed ${colors.line}`, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer", display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", flexShrink: 0 },
  dropTileOver: { borderColor: colors.accent, color: colors.accent, backgroundColor: colors.accentSoft },
  tileLabel: { fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 },
  hint: { fontSize: "11.5px", color: colors.ink3 },
  busy: { fontSize: "11.5px", color: colors.ink3 },
  hiddenInput: { position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 },
  srOnly: { position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 },
});

// reveal-on-hover for the remove control (StyleX keyed selector on the thumb)
const hoverReveal = stylex.create({
  group: {
    ":hover > [data-role='remove']": { opacity: 1 },
    ":focus-within > [data-role='remove']": { opacity: 1 },
    ":hover > [data-role='hero']": { opacity: 1 },
    ":focus-within > [data-role='hero']": { opacity: 1 },
  },
});

/**
 * A photo gallery for any target (polymorphic document links). Shows linked image
 * thumbnails with a remove control, plus a drag-and-drop / click-to-pick upload tile.
 * Backed by F05 documents (immutable originals in the object store; presigned URLs).
 */
export function MediaGallery({
  targetType,
  targetId,
  propertyId,
  label = "photos",
  readOnly = false,
  heroDocumentId,
  onSetHero,
}: {
  targetType: string;
  targetId: string;
  propertyId?: string | null;
  label?: string;
  readOnly?: boolean;
  /** When set (asset photos), each thumb gets a "set as hero" control + the current hero is marked. */
  heroDocumentId?: string | null;
  onSetHero?: (documentId: string) => void;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  const key = ["docs-for", targetType, targetId, token];
  const q = useQuery({ queryKey: key, queryFn: () => documentsFor(targetType, targetId, token) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["docs-for", targetType, targetId] });

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      Promise.all(files.map((f) => uploadAndLink(f, targetType, targetId, token, { propertyId }))),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => removePhoto(id, targetType, targetId, token),
    onSuccess: invalidate,
  });

  const accept = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (imgs.length) upload.mutate(imgs);
  };

  const photos = q.data ?? [];

  return (
    <div {...stylex.props(styles.wrap)}>
      <div
        {...stylex.props(styles.grid)}
        onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={readOnly ? undefined : () => setOver(false)}
        onDrop={readOnly ? undefined : (e) => { e.preventDefault(); setOver(false); accept(e.dataTransfer.files); }}
      >
        {photos.map((d, i) => (
          <div {...stylex.props(styles.thumb, hoverReveal.group)} key={d.id}>
            <button type="button" {...stylex.props(styles.viewBtn)} aria-label={`View ${d.name}`} onClick={() => setViewer(i)}>
              <img {...stylex.props(styles.img)} src={d.url} alt={d.name} loading="lazy" />
            </button>
            {onSetHero && (
              <button
                type="button"
                data-role="hero"
                {...stylex.props(styles.hero, d.id === heroDocumentId && styles.heroOn)}
                aria-label={d.id === heroDocumentId ? `${d.name} is the hero photo` : `Set ${d.name} as hero photo`}
                aria-pressed={d.id === heroDocumentId}
                onClick={() => onSetHero(d.id)}
              >
                {d.id === heroDocumentId ? <StarFill size={11} /> : <Star size={11} />}
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                data-role="remove"
                {...stylex.props(styles.remove)}
                aria-label={`Delete photo ${d.name}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(d.id)}
              >
                <Trash size={11} />
              </button>
            )}
          </div>
        ))}

        {!readOnly && (
          <>
            <button
              type="button"
              {...stylex.props(styles.dropTile, over && styles.dropTileOver)}
              aria-label={`Add ${label}`}
              data-testid="media-add"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {photos.length === 0 ? <Image size={18} /> : <Plus size={18} />}
              <span {...stylex.props(styles.tileLabel)}>{upload.isPending ? "…" : "Add"}</span>
            </button>
            <input
              ref={inputRef}
              {...stylex.props(styles.hiddenInput)}
              type="file"
              accept="image/*"
              multiple
              aria-label={`Upload ${label}`}
              onChange={(e) => { accept(e.target.files); e.target.value = ""; }}
            />
          </>
        )}
      </div>

      {!readOnly && photos.length === 0 && !upload.isPending && (
        <span {...stylex.props(styles.hint)}>Drag &amp; drop {label} here, or click to upload.</span>
      )}
      {upload.isError && <span {...stylex.props(styles.hint)}>Upload failed — try again.</span>}

      <Lightbox
        photos={photos}
        index={viewer}
        onClose={() => setViewer(null)}
        onIndex={setViewer}
        onDelete={readOnly ? undefined : (id) => { remove.mutate(id); setViewer(null); }}
      />
    </div>
  );
}
