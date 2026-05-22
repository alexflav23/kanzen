// Calendar view — two-way Google Calendar
function CalendarView() {
  const [view, setView] = React.useState("week");
  const [weekStart] = React.useState(new Date("2026-05-25")); // Mon
  const events = window.DATA.upcomingEvents;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  const hours = [];
  for (let h = 7; h <= 21; h++) hours.push(h);

  function eventsForDay(d) {
    return events.filter(e => {
      const ed = new Date(e.date);
      return ed.toDateString() === d.toDateString();
    });
  }

  return (
    <div className="page fade-in" style={{ maxWidth: 1400, padding: "28px 32px 60px" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Calendar</div>
          <div className="t-title">May 2026</div>
          <div className="muted t-body" style={{ marginTop: 6 }}>
            Shared household calendar · {events.length} events · synced two-way with Google Calendar
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn"><window.I.ChevronLeft size={14}/></button>
          <button className="btn btn-sm">Today</button>
          <button className="icon-btn"><window.I.ChevronRight size={14}/></button>
          <div style={{ width: 8 }}/>
          <div className="segmented">
            <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
            <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Month</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
          </div>
          <button className="btn btn-accent btn-sm"><window.I.Plus size={12}/>New event</button>
        </div>
      </header>

      {/* Legend */}
      <div className="row" style={{ marginBottom: 18, gap: 14, flexWrap: "wrap" }}>
        {[
          { label: "Delivery", color: "#4F46E5" },
          { label: "Maintenance", color: "#0EA5E9" },
          { label: "Booking", color: "#A855F7" },
          { label: "HR", color: "#F97316" },
          { label: "Finance", color: "#15803D" },
        ].map(l => (
          <div key={l.label} className="row" style={{ gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: l.color, display: "inline-block" }}/>
            {l.label}
          </div>
        ))}
        <div className="spacer"></div>
        <span className="agent-ribbon"><span className="agent-glyph"></span> 2 events from agent</span>
      </div>

      {view === "week" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid var(--line)" }}>
            <div></div>
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date("2026-05-26").toDateString();
              return (
                <div key={i} style={{ padding: "14px 12px", borderLeft: "1px solid var(--line)", textAlign: "left" }}>
                  <div className="t-small">{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                  <div style={{
                    fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em",
                    color: isToday ? "var(--accent)" : "var(--ink)",
                    marginTop: 2,
                  }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          {/* All-day row */}
          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid var(--line)", minHeight: 32 }}>
            <div className="t-small" style={{ padding: "8px 8px", textAlign: "right" }}>all-day</div>
            {days.map((d, i) => {
              const evs = eventsForDay(d).filter(e => e.time === "All day" || e.time === "Due");
              return (
                <div key={i} style={{ borderLeft: "1px solid var(--line)", padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {evs.map(e => (
                    <div key={e.id} style={{
                      background: e.color + "1A",
                      color: e.color,
                      borderLeft: "3px solid " + e.color,
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                    }}>{e.title}</div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Hours grid */}
          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", position: "relative" }}>
            <div>
              {hours.map(h => (
                <div key={h} style={{ height: 56, padding: "4px 8px", textAlign: "right" }}>
                  <span className="t-small" style={{ fontSize: 10.5 }}>{h.toString().padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {days.map((d, di) => {
              const dayEvs = eventsForDay(d).filter(e => e.time !== "All day" && e.time !== "Due");
              return (
                <div key={di} style={{ borderLeft: "1px solid var(--line)", position: "relative" }}>
                  {hours.map(h => (
                    <div key={h} style={{ height: 56, borderBottom: "1px solid var(--line)" }}></div>
                  ))}
                  {dayEvs.map(e => {
                    const start = parseInt(e.time.split(":")[0], 10);
                    const startMins = parseInt(e.time.split(":")[1]?.slice(0,2) || "0", 10);
                    const top = ((start - 7) * 56) + (startMins / 60) * 56;
                    let dur = 60;
                    if (e.time.includes("–")) {
                      const [s, ed] = e.time.split("–");
                      const sh = parseInt(s.split(":")[0], 10);
                      const sm = parseInt(s.split(":")[1] || "0", 10);
                      const eh = parseInt(ed.split(":")[0], 10);
                      const em = parseInt(ed.split(":")[1] || "0", 10);
                      dur = (eh * 60 + em) - (sh * 60 + sm);
                    }
                    const height = Math.max(40, (dur / 60) * 56);
                    return (
                      <div key={e.id} style={{
                        position: "absolute",
                        top, left: 6, right: 6,
                        height,
                        background: e.color,
                        color: "#fff",
                        borderRadius: 6,
                        padding: "6px 8px",
                        fontSize: 11.5,
                        boxShadow: "var(--shadow-1)",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}>
                        <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{e.title}</div>
                        <div style={{ opacity: 0.85, marginTop: 2, fontSize: 10.5 }}>{e.time}</div>
                        {e.source === "agent" && (
                          <div style={{ position: "absolute", top: 4, right: 6 }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: 999, background: "#fff",
                              display: "inline-block", boxShadow: "0 0 0 2px rgba(255,255,255,.3)",
                            }}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="card">
          <div className="card-header"><span className="card-title">Next 30 days · {events.length} events</span></div>
          {events.map(e => (
            <div key={e.id} className="card-row clickable">
              <div style={{
                width: 4, height: 36, background: e.color, borderRadius: 4,
              }}/>
              <div style={{ width: 90 }}>
                <div className="t-small" style={{ fontSize: 11 }}>{new Date(e.date).toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{window.fmtDateShort(e.date)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</div>
                <div className="muted t-small">{e.time}{e.property !== "—" && <><span className="dot-sep"></span>{e.property}</>}<span className="dot-sep"></span>{e.category}</div>
              </div>
              {e.source === "agent" && <span className="agent-ribbon"><span className="agent-glyph"></span></span>}
            </div>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--line)" }}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} className="t-small" style={{ padding: "10px 12px" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {(() => {
              const cells = [];
              const start = new Date("2026-04-27");
              for (let i = 0; i < 42; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const inMonth = d.getMonth() === 4;
                const isToday = d.toDateString() === new Date("2026-05-22").toDateString();
                const evs = eventsForDay(d);
                cells.push(
                  <div key={i} style={{
                    minHeight: 92,
                    borderRight: "1px solid var(--line)",
                    borderBottom: "1px solid var(--line)",
                    padding: 8,
                    background: inMonth ? "transparent" : "var(--bg)",
                    opacity: inMonth ? 1 : 0.45,
                  }}>
                    <div className="row" style={{ marginBottom: 6 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isToday ? "var(--accent-ink)" : "var(--ink-2)",
                        background: isToday ? "var(--accent)" : "transparent",
                        width: 20, height: 20, borderRadius: 999,
                        display: "grid", placeItems: "center",
                      }}>{d.getDate()}</div>
                    </div>
                    {evs.slice(0, 3).map(e => (
                      <div key={e.id} style={{
                        fontSize: 10.5, fontWeight: 500,
                        padding: "2px 6px",
                        background: e.color + "1A",
                        color: e.color,
                        borderRadius: 3,
                        marginBottom: 2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{e.title}</div>
                    ))}
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

window.CalendarView = CalendarView;
