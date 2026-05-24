import { render, screen } from "@testing-library/react";
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
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><People /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("People", () => {
  it("lists the household team from the API", async () => {
    renderPeople();
    expect(await screen.findAllByTestId("person-row")).toHaveLength(3);
  });

  it("warns about an expiring work permit", async () => {
    renderPeople();
    expect(await screen.findByText(/Work permit/)).toBeInTheDocument();
  });
});
