import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Softboard } from "@/components/softboard/softboard";
import { stubMatchMedia } from "@/test/setup";
import { makeNoteDetail, makePin } from "@/test/fixtures";

const push = vi.fn();
const boardMine = vi.fn();
const boardFeed = vi.fn();
const getNote = vi.fn();
const openShare = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      boardMine: (...args: unknown[]) => boardMine(...args),
      boardFeed: (...args: unknown[]) => boardFeed(...args),
      getNote: (...args: unknown[]) => getNote(...args),
      openShare: (...args: unknown[]) => openShare(...args),
    },
  };
});

describe("Softboard", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    push.mockReset();
    boardMine.mockReset();
    boardFeed.mockReset();
    getNote.mockReset();
    openShare.mockReset();
    boardMine.mockResolvedValue({
      items: [makePin({ title: "My sticky" })],
      nextCursor: null,
    });
    boardFeed.mockResolvedValue({
      items: [
        makePin({
          id: "feed-1",
          title: "Their sticky",
          isOwner: false,
          ownerName: "Bob",
        }),
      ],
      nextCursor: null,
    });
    getNote.mockResolvedValue(makeNoteDetail({ content: "Opened body" }));
  });

  it("renders pins from the board API", async () => {
    render(<Softboard userId="u1" token="jwt" tab="mine" />);

    expect(await screen.findByText("My sticky")).toBeInTheDocument();
    expect(boardMine).toHaveBeenCalled();
  });

  it("shows Arrange on desktop and New note on mine", async () => {
    stubMatchMedia(false);
    render(<Softboard userId="u1" token="jwt" tab="mine" />);

    await screen.findByText("My sticky");
    expect(
      screen.getByRole("button", { name: "Arrange notes in order" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New note" })
    ).toBeInTheDocument();
  });

  it("hides Arrange and New note on feed / mobile list", async () => {
    stubMatchMedia(true);
    const { unmount } = render(
      <Softboard userId="u1" token="jwt" tab="feed" />
    );

    expect(await screen.findByText("Their sticky")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Arrange notes in order" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New note" })
    ).not.toBeInTheDocument();
    unmount();
  });

  it("opens a dialog when a pin is clicked", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    render(<Softboard userId="u1" token="jwt" tab="mine" />);

    const pin = await screen.findByText("My sticky");
    await user.click(pin);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(await screen.findByText("Opened body")).toBeInTheDocument();
  });

  it("does not show New note on the feed tab (desktop)", async () => {
    stubMatchMedia(false);
    render(<Softboard userId="u1" token="jwt" tab="feed" />);

    await screen.findByText("Their sticky");
    expect(
      screen.queryByRole("button", { name: "New note" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Arrange notes in order" })
    ).toBeInTheDocument();
  });
});
