import { Pill, type PillTone } from "./Pill";

/** Shared priority vocabulary for Tasks (F06) + Lists (F08). `normal` is the calm default and renders no chip. */
export const PRIORITIES = ["urgent", "high", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

const TONE: Record<string, PillTone> = { urgent: "danger", high: "warn", normal: "default", low: "default" };

/** A priority flag — urgent (red) / high (amber) stand out; `low` is a quiet neutral chip; `normal` shows nothing
 * (so a list of mostly-normal items stays calm, Todoist-style). Tones come from the design system (AA-checked). */
export function PriorityPill({ priority }: { priority: string }) {
  if (!priority || priority === "normal") return null;
  return <Pill tone={TONE[priority] ?? "default"}>{priority === "low" ? "low priority" : priority}</Pill>;
}
