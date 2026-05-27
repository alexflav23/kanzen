import { useQuery } from "@tanstack/react-query";
import { Timeline, type TimelineItem } from "../../components/Timeline";
import { Loading, ErrorState, EmptyState } from "../../components/states";
import { useAuth } from "../../state/AuthContext";
import { getActivity } from "../../services/audit";
import { toneForAction } from "./auditTone";

/** F19/W2 — a reusable per-entity activity feed (the entity's audit trail: who changed this record, when), rendered
 *  through the shared <Timeline>. Drop onto any detail page; server-gated on reading that entity. */
export function ActivityFeed({ targetType, targetId }: { targetType: string; targetId: string }) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ["activity", targetType, targetId, token],
    queryFn: () => getActivity(token, targetType, targetId),
  });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.length === 0) return <EmptyState title="No activity yet">Changes to this record will appear here.</EmptyState>;

  const items: TimelineItem[] = q.data.map((e) => ({
    id: e.id,
    type: e.action,
    at: e.at,
    title: e.action.replace(/[._]/g, " "),
    subtitle: e.actorName ?? e.actorType,
    tone: toneForAction(e.action),
  }));
  return <Timeline items={items} />;
}
