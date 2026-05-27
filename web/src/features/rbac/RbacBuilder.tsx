import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { rbac } from "./rbacStyles";
import { PermissionSetsPanel } from "./PermissionSetsPanel";
import { RolesPanel } from "./RolesPanel";
import { TeamsPanel } from "./TeamsPanel";
import { PeoplePanel } from "./PeoplePanel";

const TABS = [
  { id: "sets", label: "Permission sets" },
  { id: "roles", label: "Roles" },
  { id: "teams", label: "Teams" },
  { id: "people", label: "People" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** F02 v2 — the HubSpot-style RBAC builder: compose permission sets, build roles (inheritance + sets), nest teams,
 *  assign people and preview their effective permissions. All admin-gated server-side; every write is audited. */
export function RbacBuilder() {
  const [tab, setTab] = useState<TabId>("sets");
  return (
    <div>
      <div {...stylex.props(rbac.tabBar)} role="tablist" aria-label="RBAC builder">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            {...stylex.props(rbac.tab, tab === t.id && rbac.tabActive)}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "sets" && <PermissionSetsPanel />}
      {tab === "roles" && <RolesPanel />}
      {tab === "teams" && <TeamsPanel />}
      {tab === "people" && <PeoplePanel />}
    </div>
  );
}
