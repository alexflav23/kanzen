import * as stylex from "@stylexjs/stylex";
import { colors } from "./styles/tokens.stylex";
import { Pill } from "./components/Pill";

// F00 app shell — the grouped left navigation (SPEC §5) + top bar.
const NAV: { group: string | null; items: string[] }[] = [
  { group: null, items: ["Dashboard", "Inbox"] },
  { group: "INVENTORY", items: ["Inventory", "Collections", "Insights"] },
  { group: "OPERATIONS", items: ["Properties", "Tasks", "Calendar", "Lists", "Maintenance"] },
  { group: "RECORDS", items: ["People", "Vendors", "Vehicles", "Documents"] },
  { group: "FINANCE & SYSTEM", items: ["Finance", "Backup", "Settings"] },
];

const styles = stylex.create({
  app: { display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", backgroundColor: colors.bg, color: colors.ink, fontFamily: "system-ui, -apple-system, sans-serif" },
  nav: { borderRight: `1px solid ${colors.line}`, padding: "20px 12px", backgroundColor: colors.bgElev },
  brand: { display: "flex", alignItems: "center", gap: "10px", padding: "0 8px 18px", fontWeight: 600, fontSize: "16px" },
  mark: { width: "26px", height: "26px", borderRadius: "8px", backgroundColor: colors.ink, color: colors.bgElev, display: "grid", placeItems: "center", fontSize: "14px" },
  group: { fontSize: "10.5px", letterSpacing: "0.08em", color: colors.ink3, textTransform: "uppercase", padding: "16px 8px 4px" },
  item: { padding: "7px 8px", borderRadius: "8px", fontSize: "13.5px", color: colors.ink2, cursor: "pointer" },
  main: { padding: "32px" },
  title: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "8px" },
  topbar: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "20px" },
});

export function App() {
  return (
    <div {...stylex.props(styles.app)}>
      <nav {...stylex.props(styles.nav)} aria-label="Primary">
        <div {...stylex.props(styles.brand)}>
          <span {...stylex.props(styles.mark)}>完</span> Kanzen
        </div>
        {NAV.map((section) => (
          <div key={section.group ?? "top"}>
            {section.group && <div {...stylex.props(styles.group)}>{section.group}</div>}
            {section.items.map((item) => (
              <div key={item} {...stylex.props(styles.item)} role="link">
                {item}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <main {...stylex.props(styles.main)}>
        <div {...stylex.props(styles.topbar)}>
          <Pill tone="accent">Foundation</Pill>
          <Pill>F00 · design system</Pill>
        </div>
        <h1 {...stylex.props(styles.title)}>Good morning.</h1>
        <p>Kanzen web shell — the StyleX design system + grouped navigation.</p>
      </main>
    </div>
  );
}
