import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/people", async () => {
  const actual = await vi.importActual<typeof import("../services/people")>("../services/people");
  return {
    ...actual, // keep daysUntil
    getPerson: vi.fn(async () => ({
      id: "3", userId: "u3", name: "Siti Rahmat", role: "Housekeeper", jurisdiction: "sg", propertyId: null,
      permitExpiry: new Date(Date.now() + 50 * 86_400_000).toISOString().slice(0, 10), reviewDue: null,
      contractType: "Full-time", startDate: "2022-09-05", endDate: null, workPermitNo: "S1234567X",
      emergencyContacts: [{ name: "Ahmad Rahmat", relation: "Brother", phone: "+65 8123 4567" }],
      payrollRef: "DBS-PR-051", notes: "MOM Work Permit — renewal tracked via permit expiry.",
    })),
  };
});
vi.mock("../services/properties", () => ({ listProperties: vi.fn(async () => []) }));
// MediaGallery hits the documents service; stub it to keep this a unit test of the detail layout.
vi.mock("../components/MediaGallery", () => ({ MediaGallery: () => <div data-testid="media-gallery" /> }));

import { PersonDetail } from "../pages/PersonDetail";

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/people/3"]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Routes><Route path="/people/:id" element={<PersonDetail />} /></Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("PersonDetail", () => {
  it("renders the rich HR record: particulars, permit, emergency contact, notes", async () => {
    renderDetail();
    expect(await screen.findByTestId("person-name")).toHaveTextContent("Siti Rahmat");
    expect(screen.getByText("S1234567X")).toBeInTheDocument(); // work permit no.
    expect(screen.getByText("Full-time")).toBeInTheDocument(); // contract
    expect(screen.getByText("DBS-PR-051")).toBeInTheDocument(); // payroll ref
    expect(screen.getByTestId("emergency-contact")).toHaveTextContent("Ahmad Rahmat");
    expect(screen.getByText(/Permit · \d+d/)).toBeInTheDocument();
    expect(screen.getByText(/renewal tracked/)).toBeInTheDocument(); // notes
    expect(screen.getByTestId("media-gallery")).toBeInTheDocument(); // HR documents
  });
});
