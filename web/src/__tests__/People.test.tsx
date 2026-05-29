import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/people", async () => {
  const actual = await vi.importActual<typeof import("../services/people")>("../services/people");
  return {
    ...actual, // keep daysUntil
    listPeople: vi.fn(async () => [
      { id: "1", userId: null, name: "Lorna", role: "House Manager", jurisdiction: "uk", propertyId: null, permitExpiry: null, reviewDue: null },
      { id: "2", userId: null, name: "Marcia", role: "Housekeeper", jurisdiction: "uk", propertyId: null, permitExpiry: null, reviewDue: null },
      { id: "3", userId: null, name: "Siti", role: "Housekeeper", jurisdiction: "sg", propertyId: null, permitExpiry: new Date(Date.now() + 50 * 86_400_000).toISOString().slice(0, 10), reviewDue: null },
    ]),
  };
});

import { People } from "../pages/People";

const renderPeople = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><People /></AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("People", () => {
  it("lists the household team from the API, each row linking to the detail", async () => {
    renderPeople();
    expect(await screen.findAllByTestId("person-row")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Open Siti's record" })).toHaveAttribute("href", "/people/3");
  });

  it("warns about an expiring work permit in the attention section", async () => {
    renderPeople();
    expect(await screen.findByText("Needs attention")).toBeInTheDocument();
    expect((await screen.findAllByText(/Permit · \d+d/)).length).toBeGreaterThan(0);
    expect(await screen.findByTestId("attention-row")).toHaveTextContent("Siti");
  });
});
