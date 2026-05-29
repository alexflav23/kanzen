import * as stylex from "@stylexjs/stylex";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import type { ComponentType } from "react";
import { colors, radius } from "./styles/tokens.stylex";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Collections } from "./pages/Collections";
import { AssetDetail } from "./pages/AssetDetail";
import { Finance } from "./pages/Finance";
import { Properties } from "./pages/Properties";
import { PropertyBible } from "./pages/PropertyBible";
import { People } from "./pages/People";
import { PersonDetail } from "./pages/PersonDetail";
import { Documents } from "./pages/Documents";
import { Vendors } from "./pages/Vendors";
import { Tasks } from "./pages/Tasks";
import { Lists } from "./pages/Lists";
import { Maintenance } from "./pages/Maintenance";
import { Products } from "./pages/Products";
import { Wealth } from "./pages/Wealth";
import { Entities } from "./pages/Entities";
import { Inbox } from "./pages/Inbox";
import { Calendar } from "./pages/Calendar";
import { Insights } from "./pages/Insights";
import { Backup } from "./pages/Backup";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { Customization } from "./pages/Customization";
import { CommandPalette } from "./components/CommandPalette";
import { NotificationsBell } from "./components/NotificationsBell";
import { BootSplash } from "./components/BootSplash";
import { useTheme } from "./theme/ThemeContext";
import * as I from "./components/icons";
import { useAuth } from "./state/AuthContext";
import { DevLogin } from "./auth/DevLogin";
import { PERSONAS } from "./services/auth";

// F00 app shell — grouped left navigation (SPEC §5; design: input/app.jsx) + routed content.
type NavItem = { label: string; route: string; icon: ComponentType<{ size?: number }>; external?: boolean };
const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [
    { label: "Dashboard", route: "/", icon: I.Grid },
    { label: "Inbox", route: "/inbox", icon: I.Inbox },
    { label: "Notifications", route: "/notifications", icon: I.Bell },
  ] },
  { group: "INVENTORY", items: [
    { label: "Inventory", route: "/inventory", icon: I.Box },
    { label: "Collections", route: "/collections", icon: I.Layers },
    { label: "Insights", route: "/insights", icon: I.PieChart },
  ] },
  { group: "OPERATIONS", items: [
    { label: "Properties", route: "/properties", icon: I.Home },
    { label: "Tasks", route: "/tasks", icon: I.Tasks, external: true },
    { label: "Calendar", route: "/calendar", icon: I.Calendar, external: true },
    { label: "Lists", route: "/lists", icon: I.Receipt },
    { label: "Supplies", route: "/supplies", icon: I.Refresh },
    { label: "Maintenance", route: "/maintenance", icon: I.Wrench },
  ] },
  { group: "RECORDS", items: [
    { label: "People", route: "/people", icon: I.People },
    { label: "Vendors", route: "/vendors", icon: I.Vendors },
    { label: "Vehicles", route: "/vehicles", icon: I.Vehicle },
    { label: "Documents", route: "/documents", icon: I.Documents, external: true },
  ] },
  { group: "FINANCE & SYSTEM", items: [
    { label: "Finance", route: "/finance", icon: I.Finance },
    { label: "Wealth", route: "/wealth", icon: I.Trending },
    { label: "Backup", route: "/backup", icon: I.Database },
    { label: "Customization", route: "/customization", icon: I.Layers },
    { label: "Settings", route: "/settings", icon: I.Settings },
  ] },
];

// F02 — the resource each nav item requires; the nav recalibrates to the principal's permissions.
const NAV_RESOURCE: Record<string, string> = {
  Inventory: "asset", Collections: "asset", Vehicles: "asset", Insights: "asset",
  Finance: "bill", Wealth: "wealth", Backup: "backup", Customization: "custom_field",
  Supplies: "product",
};

const styles = stylex.create({
  app: { display: "grid", gridTemplateColumns: "248px 1fr", gridTemplateRows: "100vh", backgroundColor: colors.bg, color: colors.ink },
  // sidebar
  sidebar: { borderRight: `1px solid ${colors.line}`, backgroundColor: colors.bg, padding: "22px 14px", display: "flex", flexDirection: "column", gap: "16px", height: "100vh", position: "sticky", top: 0, overflowY: "auto" },
  brand: { display: "flex", alignItems: "center", gap: "10px", padding: "4px 8px 2px" },
  mark: { width: "26px", height: "26px", borderRadius: "7px", backgroundColor: colors.ink, color: colors.bg, display: "grid", placeItems: "center", fontWeight: 700, fontSize: "13px" },
  brandName: { fontWeight: 600, fontSize: "15px", letterSpacing: "-0.01em" },
  section: { display: "flex", flexDirection: "column", gap: "2px" },
  group: { padding: "8px 10px 4px", fontSize: "10.5px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, color: colors.ink3 },
  item: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", borderRadius: "8px", fontSize: "13.5px", color: colors.ink2, textDecoration: "none" },
  itemActive: { backgroundColor: colors.bgElev, color: colors.ink, boxShadow: colors.shadow1 },
  icon: { color: colors.ink3, flexShrink: 0, display: "inline-flex" },
  ext: { marginLeft: "auto", color: colors.ink4, display: "inline-flex" },
  spacer: { flex: 1 },
  // account card
  account: { backgroundColor: colors.bgElev, borderRadius: radius.md, padding: "12px 14px", border: `1px solid ${colors.line}`, display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: "28px", height: "28px", borderRadius: "999px", backgroundColor: colors.accent, color: colors.accentInk, display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 600, flexShrink: 0 },
  who: { flex: 1, minWidth: 0 },
  whoName: { fontSize: "13px", fontWeight: 500, color: colors.ink },
  whoRole: { fontSize: "11px", color: colors.ink3, textTransform: "capitalize" },
  iconBtn: { width: "30px", height: "30px", display: "inline-grid", placeItems: "center", borderRadius: "8px", border: 0, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer" },
  signout: { padding: "5px 9px", borderRadius: "7px", border: `1px solid ${colors.line}`, backgroundColor: colors.bg, cursor: "pointer", fontSize: "12px", color: colors.ink2 },
  impersonate: { display: "flex", flexDirection: "column", gap: "6px" },
  impersonateLabel: { fontSize: "10.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600 },
  impersonateSelect: { width: "100%", padding: "6px 8px", borderRadius: "7px", border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "12.5px", cursor: "pointer" },
  // main
  main: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  topbar: { height: "56px", display: "flex", alignItems: "center", gap: "12px", padding: "0 28px", borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.bgOverlay, position: "sticky", top: 0, zIndex: 10, backdropFilter: "saturate(180%) blur(20px)" },
  search: { display: "flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 12px", borderRadius: "10px", backgroundColor: colors.bgSunken, color: colors.ink3, fontSize: "13px", width: "320px", cursor: "text", border: `1px solid transparent`, textAlign: "left" },
  kbd: { marginLeft: "auto", fontSize: "11px", color: colors.ink3, backgroundColor: colors.bgElev, border: `1px solid ${colors.line}`, borderRadius: "4px", padding: "1px 5px" },
  topRight: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" },
  content: { overflowY: "auto", flex: 1 },
  page: { maxWidth: "1280px", margin: "0 auto", padding: "40px 40px 80px" },
  // impersonation banner
  banner: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", backgroundColor: colors.warnSoft, color: colors.warn, fontSize: "13px", borderRadius: radius.sm, marginBottom: "20px", fontWeight: 500 },
  bannerGrow: { flex: 1 },
  bannerBtn: { padding: "5px 12px", borderRadius: "7px", border: `1px solid ${colors.warn}`, backgroundColor: "transparent", color: colors.warn, cursor: "pointer", fontSize: "12.5px", fontWeight: 600 },
});

const openPalette = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
const initials = (name?: string) => (name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function App() {
  const { token } = useAuth();
  return (
    <>
      {token ? <BrowserRouter><Shell /></BrowserRouter> : <DevLogin />}
      <BootSplash />
    </>
  );
}

function Shell() {
  const { persona, signOut, can, meLoading, me, role, impersonating, impersonate, stopImpersonating } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const canImpersonate = !impersonating && can("*", "admin");
  const visible = (label: string) => {
    if (label === "Settings") return !meLoading && can("*", "admin");
    const resource = NAV_RESOURCE[label];
    return !resource || (!meLoading && can(resource));
  };
  return (
    <>
      <div {...stylex.props(styles.app)}>
        <nav {...stylex.props(styles.sidebar)} aria-label="Primary">
          <div {...stylex.props(styles.brand)}>
            <span {...stylex.props(styles.mark)}>完</span>
            <span {...stylex.props(styles.brandName)}>Kanzen</span>
          </div>

          {NAV.map((section) => {
            const items = section.items.filter((it) => visible(it.label));
            if (items.length === 0) return null;
            return (
              <div key={section.group ?? "top"} {...stylex.props(styles.section)}>
                {section.group && <div {...stylex.props(styles.group)}>{section.group}</div>}
                {items.map((it) => {
                  const active = it.route === "/" ? pathname === "/" : pathname.startsWith(it.route);
                  const Icon = it.icon;
                  return (
                    <Link key={it.label} to={it.route} aria-current={active ? "page" : undefined} {...stylex.props(styles.item, active && styles.itemActive)}>
                      <span {...stylex.props(styles.icon)}><Icon size={16} /></span>
                      <span>{it.label}</span>
                      {it.external && <span {...stylex.props(styles.ext)}><I.External size={12} /></span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}

          <span {...stylex.props(styles.spacer)} />

          <div {...stylex.props(styles.account)}>
            <span {...stylex.props(styles.avatar)}>{initials(persona?.name)}</span>
            <div {...stylex.props(styles.who)}>
              <div {...stylex.props(styles.whoName)}>{persona?.name ?? "Signed in"}</div>
              <div {...stylex.props(styles.whoRole)}>{role ?? persona?.role}</div>
            </div>
            <button type="button" onClick={toggle} {...stylex.props(styles.iconBtn)} data-testid="theme-toggle" aria-label="Toggle light/dark theme">
              {theme === "dark" ? <I.Sun size={15} /> : <I.Moon size={15} />}
            </button>
            <button type="button" onClick={signOut} {...stylex.props(styles.signout)}>Sign out</button>
          </div>

          {canImpersonate && (
            <div {...stylex.props(styles.impersonate)} data-testid="impersonate">
              <div {...stylex.props(styles.impersonateLabel)}>View as</div>
              <select {...stylex.props(styles.impersonateSelect)} aria-label="Impersonate a user" value=""
                onChange={(e) => { if (e.target.value) void impersonate(e.target.value); }}>
                <option value="">Impersonate…</option>
                {PERSONAS.filter((p) => p.email !== me?.email).map((p) => (
                  <option key={p.email} value={p.email}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>
          )}
        </nav>

        <main {...stylex.props(styles.main)}>
          <div {...stylex.props(styles.topbar)}>
            <button type="button" {...stylex.props(styles.search)} onClick={openPalette} aria-label="Search Kanzen">
              <I.Search size={14} /> <span>Search Kanzen…</span><span {...stylex.props(styles.kbd)}>⌘K</span>
            </button>
            <span {...stylex.props(styles.topRight)}>
              <NotificationsBell />
            </span>
          </div>

          <div {...stylex.props(styles.content)}>
            <div {...stylex.props(styles.page)}>
              {impersonating && (
                <div {...stylex.props(styles.banner)} role="status" data-testid="impersonation-banner">
                  <span {...stylex.props(styles.bannerGrow)}>Viewing as <strong>{me?.email}</strong> ({role}) — admin impersonation</span>
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
                <Route path="/wealth/entities" element={<Entities />} />
                <Route path="/backup" element={<Backup />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyBible />} />
                <Route path="/people" element={<People />} />
                <Route path="/people/:id" element={<PersonDetail />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/lists" element={<Lists />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/supplies" element={<Products />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/customization" element={<Customization />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<p>Coming soon.</p>} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
      <CommandPalette />
    </>
  );
}
