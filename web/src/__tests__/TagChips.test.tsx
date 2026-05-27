import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const { listTags, createTag, tagsFor, tagEntity, untagEntity } = vi.hoisted(() => ({
  listTags: vi.fn(async () => [{ id: "t-her", name: "Heirloom" }, { id: "t-ins", name: "Insured" }]),
  createTag: vi.fn(async (name: string) => ({ id: "t-new", name })),
  tagsFor: vi.fn(async () => [{ id: "t-her", name: "Heirloom" }]),
  tagEntity: vi.fn(async () => ({ ok: true })),
  untagEntity: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../services/tags", () => ({ listTags, createTag, tagsFor, tagEntity, untagEntity }));
vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(async () => ({ userId: "u1", name: "Flavian", email: "flavian@kanzen.local", role: "principal", permissions: [], impersonatedBy: null })),
}));

import { TagChips } from "../components/TagChips";

const renderChips = (readOnly = false) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><TagChips entityType="asset" entityId="a1" readOnly={readOnly} /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("kanzen.token", "t");
  localStorage.setItem("kanzen.persona", JSON.stringify({ name: "Flavian", email: "flavian@kanzen.local", role: "principal" }));
});

describe("TagChips", () => {
  it("renders the entity's tags as removable chips", async () => {
    renderChips();
    expect(await screen.findByTestId("tag-chip")).toHaveTextContent("Heirloom");
    expect(tagsFor).toHaveBeenCalledWith("asset", "a1", "t");
    expect(screen.getByRole("button", { name: "Remove tag Heirloom" })).toBeInTheDocument();
    expect(screen.getByTestId("add-tag")).toBeInTheDocument();
  });

  it("creates + attaches a new tag from the add input", async () => {
    renderChips();
    await screen.findByTestId("tag-chip");
    fireEvent.click(screen.getByTestId("add-tag"));
    const input = screen.getByLabelText("Add a tag") as HTMLInputElement;
    await waitFor(() => expect(input.list?.options.length ?? 0).toBeGreaterThan(0)); // existing tags loaded
    fireEvent.change(input, { target: { value: "Vintage" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(tagEntity).toHaveBeenCalledTimes(1));
    expect(createTag).toHaveBeenCalledWith("Vintage", "t"); // not in the existing list → created
    expect(tagEntity).toHaveBeenCalledWith("t-new", "asset", "a1", "t");
  });

  it("reuses an existing tag instead of creating a duplicate", async () => {
    renderChips();
    await screen.findByTestId("tag-chip");
    fireEvent.click(screen.getByTestId("add-tag"));
    const input = screen.getByLabelText("Add a tag") as HTMLInputElement;
    await waitFor(() => expect(input.list?.options.length ?? 0).toBeGreaterThan(0)); // existing tags loaded
    fireEvent.change(input, { target: { value: "insured" } }); // case-insensitive match of "Insured"
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(tagEntity).toHaveBeenCalledTimes(1));
    expect(createTag).not.toHaveBeenCalled();
    expect(tagEntity).toHaveBeenCalledWith("t-ins", "asset", "a1", "t");
  });

  it("removes a tag", async () => {
    renderChips();
    await screen.findByTestId("tag-chip");
    fireEvent.click(screen.getByRole("button", { name: "Remove tag Heirloom" }));
    await waitFor(() => expect(untagEntity).toHaveBeenCalledWith("t-her", "asset", "a1", "t"));
  });

  it("hides add + remove controls when read-only", async () => {
    renderChips(true);
    await screen.findByTestId("tag-chip");
    expect(screen.queryByTestId("add-tag")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove tag/ })).not.toBeInTheDocument();
  });
});
