import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API_URL } from "../services/http";
import { useAuth } from "../state/AuthContext";

/** F48 — a realtime domain event, the wire shape the backend's RealtimeHub sends:
 *  `{eventType, subject:{type,id}, seq, payload}`. Handlers match on eventType + subject. `seq` is the resume cursor
 *  (RT.1b) — synthetic events (presence) carry 0 and never advance it. */
export type RtEvent = {
  eventType: string;
  subject: { type: string; id: string | null };
  seq?: number;
  payload: unknown;
};

type Handler = (ev: RtEvent) => void;
type RealtimeCtx = { subscribe: (h: Handler) => () => void; send: (obj: unknown) => void };

// Default = no-op so components using `useRealtime` render fine without a provider (e.g. in unit tests).
const Ctx = createContext<RealtimeCtx>({ subscribe: () => () => {}, send: () => {} });

/** ws(s):// origin for the API, derived from API_URL (http→ws, https→wss). `since` (RT.1b) asks the server to replay
 *  every event after that cursor — the rows missed while disconnected. */
const wsUrl = (token: string, since: number) => {
  const base = `${API_URL.replace(/^http/, "ws")}/api/ws?token=${encodeURIComponent(token)}`;
  return since > 0 ? `${base}&since=${since}` : base;
};

/** F48 W10-RT.1 — one WebSocket per session. Opens on sign-in, reconnects with capped backoff, and fans every
 *  inbound event to the registered handlers. A single connection carries the whole authz-filtered domain stream; each
 *  feature registers a small local handler via `useRealtime`. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const handlers = useRef(new Set<Handler>());
  const wsRef = useRef<WebSocket | null>(null);
  // the last presence frame we sent — re-announced on (re)connect so presence survives a network hiccup (RT.3)
  const lastPresence = useRef<unknown>(null);
  // RT.1b — the highest event seq processed; sent as `since` on reconnect so the server replays what we missed.
  const lastSeq = useRef(0);

  const subscribe = useMemo<RealtimeCtx["subscribe"]>(
    () => (h: Handler) => {
      handlers.current.add(h);
      return () => handlers.current.delete(h);
    },
    [],
  );

  const send = useMemo<RealtimeCtx["send"]>(
    () => (obj: unknown) => {
      if (obj && typeof obj === "object" && (obj as { kind?: string }).kind === "presence") lastPresence.current = obj;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    },
    [],
  );

  useEffect(() => {
    if (!token || typeof WebSocket === "undefined") return;
    let ws: WebSocket | null = null;
    let closed = false;
    let backoff = 500;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(wsUrl(token, lastSeq.current));
      wsRef.current = ws;
      ws.onopen = () => {
        backoff = 500;
        // re-announce what this tab is viewing, so presence is restored after a reconnect
        if (lastPresence.current && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(lastPresence.current));
      };
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data as string) as RtEvent;
          if (ev && typeof ev.eventType === "string") {
            // advance the resume cursor (idempotent handlers mean a replayed duplicate is harmless)
            if (typeof ev.seq === "number" && ev.seq > lastSeq.current) lastSeq.current = ev.seq;
            handlers.current.forEach((h) => h(ev));
          }
        } catch { /* ignore non-JSON frames (pings are handled by the WS layer) */ }
      };
      ws.onclose = () => {
        if (closed) return;
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15_000); // capped exponential backoff
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
      wsRef.current = null;
    };
  }, [token]);

  return <Ctx.Provider value={{ subscribe, send }}>{children}</Ctx.Provider>;
}

/** Register a handler for the lifetime of the calling component. The latest closure is always used (no stale handler)
 *  and the subscription is cleaned up on unmount. */
export function useRealtime(handler: Handler) {
  const { subscribe } = useContext(Ctx);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe((ev) => ref.current(ev)), [subscribe]);
}

/** F48 RT.3 — announce that this tab is viewing `(entityType, entityId)` and return the live set of *other* users also
 *  viewing it (excluding yourself). Drives the "N people here" indicator. Clears on unmount / entity change. */
export function usePresence(entityType: string, entityId: string | null | undefined): string[] {
  const { send } = useContext(Ctx);
  const { userId } = useAuth();
  const [viewers, setViewers] = useState<string[]>([]);

  useRealtime((ev) => {
    if (ev.eventType === "presence.snapshot" && ev.subject.type === entityType && ev.subject.id === entityId) {
      const ids = (ev.payload as { userIds?: string[] } | null)?.userIds ?? [];
      setViewers(ids.filter((id) => id !== userId));
    }
  });

  useEffect(() => {
    if (!entityId) return;
    send({ kind: "presence", entityType, entityId });
    return () => { send({ kind: "presence", entityType, entityId: "" }); setViewers([]); };
  }, [entityType, entityId, send]);

  return viewers;
}
