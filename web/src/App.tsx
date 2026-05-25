import * as stylex from "@stylexjs/stylex";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { colors, radius } from "./styles/tokens.stylex";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Collections } from "./pages/Collections";
import { AssetDetail } from "./pages/AssetDetail";
import { Finance } from "./pages/Finance";
import { Properties } from "./pages/Properties";
import { PropertyBible } from "./pages/PropertyBible";
import { People } from "./pages/People";
import { Documents } from "./pages/Documents";
import { Vendors } from "./pages/Vendors";
import { Tasks } from "./pages/Tasks";
import { Lists } from "./pages/Lists";
import { Maintenance } from "./pages/Maintenance";
import { Wealth } from "./pages/Wealth";
import { Inbox } from "./pages/Inbox";
import { Calendar } from "./pages/Calendar";
import { Insights } from "./pages/Insights";
import { Backup } from "./pages/Backup";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { CommandPalette } from "./components/CommandPalette";
import { ThemeToggle } from "./theme/ThemeContext";
import { useAuth } from "./state/AuthContext";
import { DevLogin } from "./auth/DevLogin";
import { PERSONAS } from "./services/auth";

// F00 app shell — grouped left navigation (SPEC §5) + routed content.
const NAV: { group: string | null; items: string[] }[] = [
  { group: null, items: ["Dashboard", "Inbox", "Notifications"] },
  { group: "INVENTORY", items: ["Inventory", "Collections", "Insights"] },
  { group: "OPERATIONS", items: ["Properties", "Tasks", "Calendar", "Lists", "Maintenance"] },
  { group: "RECORDS", items: ["People", "Vendors", "Vehicles", "Documents"] },
  { group: "FINANCE & SYSTEM", items: ["Finance", "Wealth", "Backup", "Settings"] },
];

// F02 — the resource each nav item requires; the nav recalibrates to the principal's permissions.
// Items absent here are operational/always-shown; registry/finance/wealth are permission-gated.
const NAV_RESOURCE: Record<string, string> = {
  Inventory: "asset", Collections: "asset", Vehicles: "asset", Insights: "asset",
  Finance: "bill", Wealth: "wealth", Backup: "backup",
};

function routeFor(item: string): string {
  if (item === "Dashboard") return "/";
  if (item === "Inbox") return "/inbox";
  if (item === "Notifications") return "/notifications";
  if (item === "Inventory") return "/inventory";
  if (item === "Collections") return "/collections";
  if (item === "Insights") return "/insights";
  if (item === "Finance") return "/finance";
  if (item === "Wealth") return "/wealth";
  if (item === "Backup") return "/backup";
  if (item === "Properties") return "/properties";
  if (item === "People") return "/people";
  if (item === "Documents") return "/documents";
  if (item === "Vendors") return "/vendors";
  if (item === "Tasks") return "/tasks";
  if (item === "Lists") return "/lists";
  if (item === "Maintenance") return "/maintenance";
  if (item === "Calendar") return "/calendar";
  if (item === "Vehicles") return "/vehicles";
  if (item === "Settings") return "/settings";
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
  impersonate: { marginTop: "12px" },
  impersonateLabel: { fontSize: "10.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, marginBottom: "6px" },
  impersonateSelect: { width: "100%", padding: "6px 8px", borderRadius: "7px", border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "12.5px", cursor: "pointer" },
  banner: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", backgroundColor: colors.warnSoft, color: colors.warn, fontSize: "13px", borderRadius: radius.sm, marginBottom: "20px", fontWeight: 500 },
  bannerGrow: { flex: 1 },
  bannerBtn: { padding: "5px 12px", borderRadius: "7px", border: `1px solid ${colors.warn}`, backgroundColor: "transparent", color: colors.warn, cursor: "pointer", fontSize: "12.5px", fontWeight: 600 },
});

export function App() {
  const { token, persona, signOut, can, meLoading, me, impersonating, impersonate, stopImpersonating } = useAuth();
  if (!token) return <DevLogin />;
  const canImpersonate = !impersonating && can("*", "admin"); // an admin not already acting-as someone
  // F02 — recalibrate the nav to the principal's permissions. While /api/me loads, show only the
  // ungated items (avoids a flash of gated links the principal may not keep).
  const visible = (item: string) => {
    if (item === "Settings") return !meLoading && can("*", "admin"); // role-management is admin-only
    const resource = NAV_RESOURCE[item];
    return !resource || (!meLoading && can(resource));
  };
  return (
    <BrowserRouter>
      <div {...stylex.props(styles.app)}>
        <nav {...stylex.props(styles.nav)} aria-label="Primary">
          <div {...stylex.props(styles.brand)}>
            <span {...stylex.props(styles.mark)}>完</span> Kanzen
          </div>
          {NAV.map((section) => {
            const items = section.items.filter(visible);
            if (items.length === 0) return null;
            return (
            <div key={section.group ?? "top"}>
              {section.group && <div {...stylex.props(styles.group)}>{section.group}</div>}
              {items.map((item) => (
                <Link key={item} to={routeFor(item)} {...stylex.props(styles.item)}>
                  {item}
                </Link>
              ))}
            </div>
            );
          })}
          <ThemeToggle />
          <div {...stylex.props(styles.account)}>
            <div {...stylex.props(styles.who)}>
              {persona?.name ?? "Signed in"}
              <div {...stylex.props(styles.whoRole)}>{me?.role ?? persona?.role}</div>
            </div>
            <button type="button" onClick={signOut} {...stylex.props(styles.signout)}>Sign out</button>
          </div>
          {canImpersonate && (
            <div {...stylex.props(styles.impersonate)} data-testid="impersonate">
              <div {...stylex.props(styles.impersonateLabel)}>View as</div>
              <select
                {...stylex.props(styles.impersonateSelect)}
                aria-label="Impersonate a user"
                value=""
                onChange={(e) => { if (e.target.value) void impersonate(e.target.value); }}
              >
                <option value="">Impersonate…</option>
                {PERSONAS.filter((p) => p.email !== me?.email).map((p) => (
                  <option key={p.email} value={p.email}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>
          )}
        </nav>
        <main {...stylex.props(styles.main)}>
          {impersonating && (
            <div {...stylex.props(styles.banner)} role="status" data-testid="impersonation-banner">
              <span {...stylex.props(styles.bannerGrow)}>Viewing as <strong>{me?.email}</strong> ({me?.role}) — admin impersonation</span>
              <button type="button" onClick={stopImpersonating} {...stylex.props(styles.bannerBtn)} data-testid="stop-impersonating">Stop</button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/vehicles" element={<Inventory vertical="vehicle" label="Vehicles" />} />
            <Route path="/inventory/:id" element={<AssetDetail />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/wealth" element={<Wealth />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/properties/:id" element={<PropertyBible />} />
            <Route path="/people" element={<People />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<p>Coming soon.</p>} />
          </Routes>
        </main>
        <CommandPalette />
      </div>
    </BrowserRouter>
  );
}
