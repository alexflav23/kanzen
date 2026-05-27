import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Lightbox } from "../components/Lightbox";

const photos = [
  { id: "1", url: "u1", name: "Front" },
  { id: "2", url: "u2", name: "Back" },
];

describe("Lightbox", () => {
  it("renders nothing when closed (index null)", () => {
    const { container } = render(<Lightbox photos={photos} index={null} onClose={() => {}} onIndex={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the selected photo at full size + a counter", () => {
    render(<Lightbox photos={photos} index={0} onClose={() => {}} onIndex={() => {}} />);
    expect(screen.getByTestId("lightbox")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("lightbox-image")).toHaveAttribute("src", "u1");
    expect(screen.getByText("Front")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("next / prev navigate (wrapping) via onIndex", () => {
    const onIndex = vi.fn();
    render(<Lightbox photos={photos} index={0} onClose={() => {}} onIndex={onIndex} />);
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(onIndex).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(onIndex).toHaveBeenCalledWith(1); // 0 → prev wraps to last (index 1)
  });

  it("arrow keys navigate", () => {
    const onIndex = vi.fn();
    render(<Lightbox photos={photos} index={0} onClose={() => {}} onIndex={onIndex} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onIndex).toHaveBeenCalledWith(1);
  });

  it("Escape, the close button, and the backdrop all close", () => {
    const onClose = vi.fn();
    render(<Lightbox photos={photos} index={0} onClose={onClose} onIndex={() => {}} />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close viewer" }));
    fireEvent.click(screen.getByTestId("lightbox")); // backdrop (the overlay itself)
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("shows a Delete button only when onDelete is given, and calls it", () => {
    const onDelete = vi.fn();
    const { rerender } = render(<Lightbox photos={photos} index={0} onClose={() => {}} onIndex={() => {}} />);
    expect(screen.queryByRole("button", { name: /Delete photo/ })).not.toBeInTheDocument();
    rerender(<Lightbox photos={photos} index={0} onClose={() => {}} onIndex={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete photo Front" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("hides nav controls when there is only one photo", () => {
    render(<Lightbox photos={[photos[0]]} index={0} onClose={() => {}} onIndex={() => {}} />);
    expect(screen.queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
  });
});
