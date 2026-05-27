import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline, type TimelineItem } from "../components/Timeline";

const items: TimelineItem[] = [
  { id: "1", type: "acquired", at: "2019-04-02T00:00:00Z", title: "acquired", amountMinor: 1850000, currency: "GBP" },
  { id: "2", type: "serviced", at: "2024-06-10T00:00:00Z", title: "serviced", party: "Watchfinder", amountMinor: 32000, currency: "GBP" },
  { id: "3", type: "moved", at: "2025-01-05T00:00:00Z", title: "moved", subtitle: "to the safe" },
  { id: "4", type: "stolen", at: "2025-03-01T00:00:00Z", title: "stolen" },
  { id: "5", type: "note", at: "2025-04-01T00:00:00Z", title: "note" },
];

describe("Timeline", () => {
  it("renders a row per event with colour-coded dots by category", () => {
    render(<Timeline items={items} />);
    const rows = screen.getAllByTestId("timeline-row");
    expect(rows).toHaveLength(5);
    const tone = (i: number) => rows[i].getAttribute("data-tone");
    expect(tone(0)).toBe("accent"); // acquired
    expect(tone(1)).toBe("info"); // serviced (cyan)
    expect(tone(2)).toBe("violet"); // moved (purple)
    expect(tone(3)).toBe("danger"); // stolen
    expect(tone(4)).toBe("muted"); // note
  });

  it("shows the cost pill and party on the relevant events", () => {
    render(<Timeline items={items} />);
    expect(screen.getByText("£18,500")).toBeInTheDocument(); // acquisition cost (whole units, design style)
    expect(screen.getByText(/Watchfinder/)).toBeInTheDocument(); // party on the service event
    expect(screen.getByText("to the safe")).toBeInTheDocument(); // subtitle on the move
  });

  it("honours an explicit tone override (for non-asset-event sources, e.g. the audit log)", () => {
    render(<Timeline items={[{ id: "x", type: "bill.approve", at: "2025-05-01T00:00:00Z", title: "Approved a bill", tone: "positive" }]} />);
    expect(screen.getByTestId("timeline-row").getAttribute("data-tone")).toBe("positive");
  });
});
