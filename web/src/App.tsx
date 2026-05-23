import * as stylex from "@stylexjs/stylex";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { colors } from "./styles/tokens.stylex";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";

// F00 app shell — grouped left navigation (SPEC §5) + routed content.
const NAV: { group: string | null; items: string[] }[] = [
  { group: null, items: ["Dashboard", "Inbox"] },
  { group: "INVENTORY", items: ["Inventory", "Collections", "Insights"] },
  { group: "OPERATIONS", items: ["Properties", "Tasks", "Calendar", "Lists", "Maintenance"] },
  { group: "RECORDS", items: ["People", "Vendors", "Vehicles", "Documents"] },
  { group: "FINANCE & SYSTEM", items: ["Finance", "Backup", "Settings"] },
];

function routeFor(item: string): string {
  if (item === "Dashboard") return "/";
  if (item === "Inventory") return "/inventory";
  return "/soon";
}

const styles = stylex.create({
  app: { display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", backgroundColor: colors.bg, color: colors.ink, fontFamily: "system-ui, -apple-system, sans-serif" },
  nav: { borderRight: `1px solid ${colors.line}`, padding: "20px 12px", backgroundColor: colors.bgElev },
  brand: { display: "flex", alignItems: "center", gap: "10px", padding: "0 8px 18px", fontWeight: 600, fontSize: "16px" },
  mark: { width: "26px", height: "26px", borderRadius: "8px", backgroundColor: colors.ink, color: colors.bgElev, display: "grid", placeItems: "center", fontSize: "14px" },
  group: { fontSize: "10.5px", letterSpacing: "0.08em", color: colors.ink3, textTransform: "uppercase", padding: "16px 8px 4px" },
  item: { display: "block", padding: "7px 8px", borderRadius: "8px", fontSize: "13.5px", color: colors.ink2, textDecoration: "none" },
  main: { padding: "32px" },
});

export function App() {
  return (
    <BrowserRouter>
      <div {...stylex.props(styles.app)}>
        <nav {...stylex.props(styles.nav)} aria-label="Primary">
          <div {...stylex.props(styles.brand)}>
            <span {...stylex.props(styles.mark)}>完</span> Kanzen
          </div>
          {NAV.map((section) => (
            <div key={section.group ?? "top"}>
              {section.group && <div {...stylex.props(styles.group)}>{section.group}</div>}
              {section.items.map((item) => (
                <Link key={item} to={routeFor(item)} {...stylex.props(styles.item)}>
                  {item}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <main {...stylex.props(styles.main)}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="*" element={<p>Coming soon.</p>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
