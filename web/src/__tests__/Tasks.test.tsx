import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/tasks", () => ({
  listTasks: vi.fn(async () => [
    { id: "t1", projectId: "p1", title: "Water the plants", status: "todo", dueOn: "2026-06-01", recurrence: "weekly" },
    { id: "t2", projectId: "p1", title: "Service the boiler", status: "todo", dueOn: null, recurrence: null },
  ]),
  listProjects: vi.fn(async () => [{ id: "p1", name: "Household", propertyId: null }]),
  createTask: vi.fn(),
  completeTask: vi.fn(),
}));

import { Tasks } from "../pages/Tasks";

const renderTasks = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Tasks /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Tasks", () => {
  it("lists tasks from the API with recurrence", async () => {
    renderTasks();
    expect(await screen.findAllByTestId("task-row")).toHaveLength(2);
    expect(screen.getByText("Water the plants")).toBeInTheDocument();
    expect(screen.getByText("weekly")).toBeInTheDocument();
  });
});
