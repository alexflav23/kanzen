import * as stylex from "@stylexjs/stylex";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { colors } from "./styles/tokens.stylex";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { AssetDetail } from "./pages/AssetDetail";
import { Finance } from "./pages/Finance";
import { Properties } from "./pages/Properties";
import { PropertyBible } from "./pages/PropertyBible";
import { People } from "./pages/People";
import { Documents } from "./pages/Documents";
import { ThemeToggle } from "./theme/ThemeContext";
import { useAuth } from "./state/AuthContext";
import { DevLogin } from "./auth/DevLogin";

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
  if (item === "Finance") return "/finance";
  if (item === "Properties") return "/properties";
  if (item === "People") return "/people";
  if (item === "Documents") return "/documents";
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
  account: { marginTop: "16px", paddingTop: "14px", borderTop: `1px solid ${colors.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" },
  who: { fontSize: "13px", color: colors.ink2, lineHeight: 1.25 },
  whoRole: { fontSize: "11px", color: colors.ink3, textTransform: "capitalize" },
  signout: { padding: "5px 9px", borderRadius: "7px", border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12px", color: colors.ink2 },
});

export function App() {
  const { token, persona, signOut } = useAuth();
  if (!token) return <DevLogin />;
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
          <ThemeToggle />
          <div {...stylex.props(styles.account)}>
            <div {...stylex.props(styles.who)}>
              {persona?.name ?? "Signed in"}
              <div {...stylex.props(styles.whoRole)}>{persona?.role}</div>
            </div>
            <button type="button" onClick={signOut} {...stylex.props(styles.signout)}>Sign out</button>
          </div>
        </nav>
        <main {...stylex.props(styles.main)}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/:id" element={<AssetDetail />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/properties/:id" element={<PropertyBible />} />
            <Route path="/people" element={<People />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="*" element={<p>Coming soon.</p>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
