import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { useAuth } from "../state/AuthContext";
import { listChats, createChat } from "../services/chat";
import { listPeople } from "../services/people";
import { CollabPanel } from "../components/CollabPanel";
import { Avatar } from "../components/Avatar";
import { useRealtime } from "../realtime/RealtimeProvider";
import { Plus } from "../components/icons";

const styles = stylex.create({
  wrap: { display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", height: "calc(100vh - 120px)" },
  col: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, overflow: "hidden", display: "flex", flexDirection: "column" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${colors.line}` },
  h: { fontSize: "15px", fontWeight: 600, color: colors.ink },
  newBtn: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: radius.md, border: 0, backgroundColor: colors.accent, color: colors.accentInk, fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
  list: { overflowY: "auto", flex: 1 },
  row: { display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, border: 0, borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: colors.line, background: "transparent", cursor: "pointer", textAlign: "left", ":hover": { backgroundColor: colors.bgSunken } },
  rowOn: { backgroundColor: colors.accentSoft },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontSize: "13.5px", fontWeight: 600, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowMsg: { fontSize: "12px", color: colors.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" },
  empty: { padding: "30px 18px", fontSize: "13px", color: colors.ink3, textAlign: "center" },
  detail: { padding: "8px 14px", flex: 1, overflowY: "auto" },
  picker: { padding: "14px 16px", borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.bgSunken },
  pickRow: { display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "8px 6px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", color: colors.ink, fontSize: "13px", borderRadius: radius.sm, ":hover": { backgroundColor: colors.bgElev } },
});

/** F48 RT.4 — chat. A two-pane surface: your chats on the left, the open chat's messages (a CollabPanel on
 *  entityType='chat') on the right. New messages + presence are live via the realtime layer; a new chat appears when
 *  its first message arrives (comment.created). */
export function Chat() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const chatsQ = useQuery({ queryKey: ["chats", token], queryFn: () => listChats(token) });
  const peopleQ = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token), enabled: picking });
  const candidates = useMemo(
    () => (peopleQ.data ?? []).flatMap((p) => (p.userId ? [{ userId: p.userId, name: p.name, colour: p.colour }] : [])),
    [peopleQ.data],
  );

  // a message in any chat refreshes the list (last-message + ordering)
  useRealtime((ev) => {
    if (ev.eventType === "comment.created" && ev.subject.type === "chat") qc.invalidateQueries({ queryKey: ["chats"] });
  });

  const start = async (userId: string) => {
    const chat = await createChat([userId], token);
    setPicking(false);
    qc.invalidateQueries({ queryKey: ["chats"] });
    setSelected(chat.id);
  };

  const chats = chatsQ.data ?? [];

  return (
    <div>
      <h1 style={{ fontSize: "26px", fontWeight: 700, marginBottom: "18px" }}>Chat</h1>
      <div {...stylex.props(styles.wrap)}>
        <div {...stylex.props(styles.col)}>
          <div {...stylex.props(styles.head)}>
            <span {...stylex.props(styles.h)}>Messages</span>
            <button type="button" {...stylex.props(styles.newBtn)} onClick={() => setPicking((v) => !v)} data-testid="new-chat">
              <Plus size={13} /> New
            </button>
          </div>
          {picking && (
            <div {...stylex.props(styles.picker)} data-testid="chat-picker">
              {candidates.map((c) => (
                <button key={c.userId} type="button" {...stylex.props(styles.pickRow)} onClick={() => start(c.userId)}>
                  <Avatar name={c.name} size={22} colour={c.colour} /> {c.name}
                </button>
              ))}
              {candidates.length === 0 && <div {...stylex.props(styles.empty)}>No one to message yet.</div>}
            </div>
          )}
          <div {...stylex.props(styles.list)}>
            {chats.map((c) => (
              <button
                key={c.id}
                type="button"
                {...stylex.props(styles.row, selected === c.id && styles.rowOn)}
                onClick={() => setSelected(c.id)}
                data-testid="chat-row"
              >
                <Avatar name={c.members[0] ?? "Chat"} size={30} colour={null} />
                <div {...stylex.props(styles.rowMain)}>
                  <div {...stylex.props(styles.rowName)}>{c.members.join(", ") || "Chat"}</div>
                  <div {...stylex.props(styles.rowMsg)}>{c.lastMessage ?? "No messages yet"}</div>
                </div>
              </button>
            ))}
            {chats.length === 0 && !picking && <div {...stylex.props(styles.empty)}>No chats yet — start one with “New”.</div>}
          </div>
        </div>

        <div {...stylex.props(styles.col)}>
          {selected ? (
            <div {...stylex.props(styles.detail)}>
              <CollabPanel
                entityType="chat"
                entityId={selected}
                title={chats.find((c) => c.id === selected)?.members.join(", ") || "Chat"}
              />
            </div>
          ) : (
            <div {...stylex.props(styles.empty)} style={{ margin: "auto" }}>Select a chat to start messaging.</div>
          )}
        </div>
      </div>
    </div>
  );
}
