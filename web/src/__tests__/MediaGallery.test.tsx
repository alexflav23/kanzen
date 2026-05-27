import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const { uploadAndLink, unlinkDocument, documentsFor } = vi.hoisted(() => ({
  uploadAndLink: vi.fn(async () => "doc-new"),
  unlinkDocument: vi.fn(async () => ({})),
  documentsFor: vi.fn(async () => [
    { id: "d1", name: "fridge.jpg", contentType: "image/jpeg", sizeBytes: 1234, url: "https://signed/d1", expiresInSeconds: 300 },
  ]),
}));

vi.mock("../services/documents", () => ({ documentsFor, uploadAndLink, unlinkDocument }));
vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(async () => ({ userId: "u1", name: "Flavian", email: "flavian@kanzen.local", role: "principal", permissions: [], impersonatedBy: null })),
}));

import { MediaGallery } from "../components/MediaGallery";

const renderGallery = (readOnly = false) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MediaGallery targetType="list_item" targetId="i1" readOnly={readOnly} />
      </AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("kanzen.token", "t");
  localStorage.setItem("kanzen.persona", JSON.stringify({ name: "Flavian", email: "flavian@kanzen.local", role: "principal" }));
});

describe("MediaGallery", () => {
  it("renders linked photo thumbnails with a presigned src + remove control", async () => {
    renderGallery();
    const img = await screen.findByRole("img", { name: "fridge.jpg" });
    expect(img).toHaveAttribute("src", "https://signed/d1");
    expect(documentsFor).toHaveBeenCalledWith("list_item", "i1", "t");
    expect(screen.getByRole("button", { name: "Remove photo fridge.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add photos" })).toBeInTheDocument();
  });

  it("uploads + links a dropped/picked image", async () => {
    renderGallery();
    await screen.findByRole("img", { name: "fridge.jpg" });
    const input = screen.getByLabelText("Upload photos") as HTMLInputElement;
    const file = new File(["x"], "new.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadAndLink).toHaveBeenCalledTimes(1));
    expect(uploadAndLink).toHaveBeenCalledWith(expect.any(File), "list_item", "i1", "t", expect.anything());
  });

  it("ignores non-image files", async () => {
    renderGallery();
    const input = screen.getByLabelText("Upload photos") as HTMLInputElement;
    const pdf = new File(["x"], "receipt.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(uploadAndLink).not.toHaveBeenCalled();
  });

  it("hides upload + remove controls when read-only", async () => {
    renderGallery(true);
    await screen.findByRole("img", { name: "fridge.jpg" });
    expect(screen.queryByRole("button", { name: "Add photos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove photo/ })).not.toBeInTheDocument();
  });

  it("opens the full-res lightbox when a thumbnail is clicked", async () => {
    renderGallery();
    await screen.findByRole("img", { name: "fridge.jpg" });
    fireEvent.click(screen.getByRole("button", { name: "View fridge.jpg" }));
    expect(screen.getByTestId("lightbox")).toBeInTheDocument();
    expect(screen.getByTestId("lightbox-image")).toHaveAttribute("src", "https://signed/d1");
  });

  it("offers a set-hero control and marks the current hero (when onSetHero given)", async () => {
    const onSetHero = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <MediaGallery targetType="asset" targetId="a1" heroDocumentId="d1" onSetHero={onSetHero} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    // d1 is the current hero → its control reads "is the hero photo"
    expect(await screen.findByRole("button", { name: "fridge.jpg is the hero photo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "fridge.jpg is the hero photo" }));
    expect(onSetHero).toHaveBeenCalledWith("d1");
  });
});
