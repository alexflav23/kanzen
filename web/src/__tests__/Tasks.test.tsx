import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/tasks", () => ({
  listTasks: vi.fn(async () => [
    { id: "t1", projectId: "p1", title: "Water the plants", status: "todo", dueOn: "2026-06-01", recurrence: "weekly", assigneeId: "u1" },
    { id: "t2", projectId: "p1", title: "Service the boiler", status: "todo", dueOn: null, recurrence: null, assigneeId: null },
  ]),
  listProjects: vi.fn(async () => [{ id: "p1", name: "Household", propertyId: null }]),
  createTask: vi.fn(),
  completeTask: vi.fn(),
}));
vi.mock("../services/people", () => ({
  listPeople: vi.fn(async () => [{ id: "u1", name: "Marcia", role: "staff", jurisdiction: null, propertyId: null }]),
}));

import { Tasks } from "../pages/Tasks";
import { createTask } from "../services/tasks";

const renderTasks = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Tasks /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Tasks", () => {
  it("lists tasks with recurrence + the resolved assignee", async () => {
    renderTasks();
    expect(await screen.findAllByTestId("task-row")).toHaveLength(2);
    expect(screen.getByText("Water the plants")).toBeInTheDocument();
    expect(screen.getByText("weekly")).toBeInTheDocument();
    expect(screen.getByText("Marcia")).toBeInTheDocument(); // assignee resolved from the people list
  });

  it("creates a task with project · due date · recurrence · assignee via the modal", async () => {
    renderTasks();
    await screen.findAllByTestId("task-row");
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const modal = await screen.findByTestId("new-task");
    fireEvent.change(within(modal).getByLabelText("Title"), { target: { value: "Polish silver" } });
    fireEvent.change(within(modal).getByLabelText("Assignee"), { target: { value: "u1" } });
    fireEvent.change(within(modal).getByLabelText("Due date"), { target: { value: "2026-06-10" } });
    fireEvent.change(within(modal).getByLabelText("Recurrence"), { target: { value: "monthly" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        { projectId: "p1", title: "Polish silver", dueOn: "2026-06-10", recurrence: "monthly", assigneeId: "u1" },
        "t",
      ),
    );
  });
});
