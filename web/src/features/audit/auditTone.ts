import type { TimelineTone } from "../../components/Timeline";

/** Map an audit action key → a timeline tone. Shared by the platform Audit log + per-entity activity feeds, so the
 *  colour language is consistent (state is carried by tone + label, never colour alone). */
export function toneForAction(action: string): TimelineTone {
  if (/(delete|remove|untag|decline|reject)/.test(action)) return "danger";
  if (/(approve|pay|value|valuation|reconcile|restore|complete)/.test(action)) return "positive";
  if (/(move|custody|hero|order|schedule)/.test(action)) return "violet";
  if (/^(permission|role|rbac|impersonate|team|backup|user)/.test(action)) return "muted";
  if (/(create|add|upload|propose|new|\.set)/.test(action)) return "accent";
  return "info";
}
