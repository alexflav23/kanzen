import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RealtimeProvider, useRealtime, type RtEvent } from "../realtime/RealtimeProvider";

// A tiny fake WebSocket we can drive from the test.
class FakeWS {
  static last: FakeWS | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly url: string;
  closed = false;
  constructor(url: string) { this.url = url; FakeWS.last = this; setTimeout(() => this.onopen?.(), 0); }
  send() {}
  close() { this.closed = true; }
  emit(ev: RtEvent) { this.onmessage?.({ data: JSON.stringify(ev) }); }
}

// The provider reads the token from AuthContext; mock it to a signed-in session.
vi.mock("../state/AuthContext", () => ({ useAuth: () => ({ token: "tok.tok.tok" }) }));

function Probe({ onEvent }: { onEvent: (ev: RtEvent) => void }) {
  useRealtime(onEvent);
  return <div>probe</div>;
}

describe("F48 realtime client", () => {
  beforeEach(() => { (globalThis as unknown as { WebSocket: typeof FakeWS }).WebSocket = FakeWS; FakeWS.last = null; });
  afterEach(() => { vi.restoreAllMocks(); });

  it("opens one ws with the token in the query string and dispatches events to handlers", async () => {
    const seen: RtEvent[] = [];
    render(
      <RealtimeProvider>
        <Probe onEvent={(ev) => seen.push(ev)} />
      </RealtimeProvider>,
    );
    expect(screen.getByText("probe")).toBeTruthy();
    await waitFor(() => expect(FakeWS.last).not.toBeNull());
    expect(FakeWS.last!.url).toContain("/api/ws?token=tok.tok.tok");

    const ev: RtEvent = { eventType: "comment.created", subject: { type: "email_thread", id: "t1" }, payload: {} };
    FakeWS.last!.emit(ev);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].eventType).toBe("comment.created");
    expect(seen[0].subject.id).toBe("t1");
  });

  it("tracks the event seq and replays from it (since cursor) on reconnect", async () => {
    render(<RealtimeProvider><Probe onEvent={() => {}} /></RealtimeProvider>);
    await waitFor(() => expect(FakeWS.last).not.toBeNull());
    const first = FakeWS.last!;
    expect(first.url).not.toContain("since="); // a fresh connection has no cursor yet

    // process an event carrying seq=42; a synthetic seq-0 frame must NOT advance the cursor
    first.emit({ eventType: "task.updated", subject: { type: "task", id: "t1" }, seq: 42, payload: {} } as RtEvent);
    first.emit({ eventType: "presence.snapshot", subject: { type: "task", id: "t1" }, seq: 0, payload: {} } as RtEvent);

    // a drop → the provider reconnects asking the server to replay everything after seq 42
    first.onclose?.();
    await waitFor(() => expect(FakeWS.last).not.toBe(first), { timeout: 2000 });
    expect(FakeWS.last!.url).toContain("since=42");
  });

  it("a malformed frame does not throw or dispatch", async () => {
    const seen: RtEvent[] = [];
    render(<RealtimeProvider><Probe onEvent={(ev) => seen.push(ev)} /></RealtimeProvider>);
    await waitFor(() => expect(FakeWS.last).not.toBeNull());
    FakeWS.last!.onmessage?.({ data: "not json{" });
    expect(seen).toHaveLength(0);
  });
});
