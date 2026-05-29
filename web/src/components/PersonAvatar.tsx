import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { colors, radius } from "../styles/tokens.stylex";
import { Avatar } from "./Avatar";

type Person = { id: string; name: string; role?: string | null; propertyId?: string | null };

const styles = stylex.create({
  wrap: { position: "relative", display: "inline-flex" },
  trigger: { display: "inline-flex", borderRadius: "999px", border: 0, background: "transparent", padding: 0, cursor: "pointer" },
  pop: { position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, width: "236px", backgroundColor: colors.bgElev, border: `1px solid ${colors.line}`, borderRadius: radius.md, boxShadow: colors.shadowPop, padding: "14px", textAlign: "left" },
  head: { display: "flex", gap: "10px", alignItems: "center" },
  name: { fontSize: "14px", fontWeight: 600, color: colors.ink },
  role: { fontSize: "12px", color: colors.ink3, textTransform: "capitalize" },
  meta: { fontSize: "12px", color: colors.ink3, margin: "10px 0" },
  view: { display: "inline-block", fontSize: "12.5px", color: colors.accent, textDecoration: "none", fontWeight: 500, marginTop: "8px" },
  label: { fontSize: "11px", color: colors.ink3, margin: "12px 0 4px", display: "block", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 },
  select: { width: "100%", padding: "7px 9px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "12.5px", boxSizing: "border-box" },
});

/** A person's round avatar that links to their profile page, reveals a hover/focus profile card (name · role ·
 * property · View profile), and — for those with permission — lets you reassign from the card. Used on tasks, and
 * reusable anywhere a person is shown. Photo when set, initials fallback. */
export function PersonAvatar({ person, propertyName, photoUrl, canReassign, people, onReassign, size = 24 }: {
  person: Person;
  propertyName?: string;
  photoUrl?: string | null;
  canReassign?: boolean;
  people?: { id: string; name: string }[];
  onReassign?: (personId: string) => void;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enter = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const leave = () => { timer.current = setTimeout(() => setOpen(false), 160); };
  return (
    <span {...stylex.props(styles.wrap)} onMouseEnter={enter} onMouseLeave={leave}>
      <Link to={`/people/${person.id}`} {...stylex.props(styles.trigger)} aria-label={`${person.name} — view profile`} onFocus={enter} onBlur={leave}>
        <Avatar name={person.name} photoUrl={photoUrl} size={size} />
      </Link>
      {open && (
        <div {...stylex.props(styles.pop)} role="dialog" aria-label={`${person.name} — profile`} data-testid="person-card" onMouseEnter={enter} onMouseLeave={leave}>
          <div {...stylex.props(styles.head)}>
            <Avatar name={person.name} photoUrl={photoUrl} size={40} />
            <div>
              <div {...stylex.props(styles.name)}>{person.name}</div>
              {person.role && <div {...stylex.props(styles.role)}>{person.role}</div>}
            </div>
          </div>
          {propertyName && <div {...stylex.props(styles.meta)}>Based at {propertyName}</div>}
          <Link to={`/people/${person.id}`} {...stylex.props(styles.view)}>View profile →</Link>
          {canReassign && people && onReassign && (
            <>
              <span {...stylex.props(styles.label)}>Reassign to</span>
              <select {...stylex.props(styles.select)} aria-label="Reassign to" value={person.id}
                onChange={(e) => { if (e.target.value && e.target.value !== person.id) onReassign(e.target.value); }}>
                {people.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
              </select>
            </>
          )}
        </div>
      )}
    </span>
  );
}
