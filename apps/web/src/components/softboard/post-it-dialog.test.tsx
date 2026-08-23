import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostItDialog } from "@/components/softboard/post-it-dialog";
import { ApiError } from "@/lib/api";
import {
  makeNoteDetail,
  makePin,
  makeSharedView,
} from "@/test/fixtures";

const getNote = vi.fn();
const openShare = vi.fn();
const unlockShare = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      getNote: (...args: unknown[]) => getNote(...args),
      openShare: (...args: unknown[]) => openShare(...args),
      unlockShare: (...args: unknown[]) => unlockShare(...args),
    },
  };
});

describe("PostItDialog", () => {
  beforeEach(() => {
    getNote.mockReset();
    openShare.mockReset();
    unlockShare.mockReset();
  });

  it("loads owner note content via getNote on mine tab", async () => {
    getNote.mockResolvedValue(makeNoteDetail({ content: "Owner secret" }));
    const onClose = vi.fn();

    render(
      <PostItDialog
        pin={makePin({ isOwner: true })}
        tab="mine"
        authToken="jwt"
        onClose={onClose}
      />
    );

    expect(screen.getByText("Opening…")).toBeInTheDocument();
    expect(await screen.findByText("Owner secret")).toBeInTheDocument();
    expect(getNote).toHaveBeenCalledWith("jwt", "pin-1");
    expect(openShare).not.toHaveBeenCalled();
  });

  it("opens feed public pins via openShare", async () => {
    openShare.mockResolvedValue(
      makeSharedView({ title: "Public pin", content: "Shared body" })
    );

    render(
      <PostItDialog
        pin={makePin({
          id: "pin-2",
          title: "Public pin",
          isOwner: false,
          ownerName: "Bob",
        })}
        tab="feed"
        authToken="jwt"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText("Shared body")).toBeInTheDocument();
    expect(openShare).toHaveBeenCalledWith("tok-1", "jwt");
    expect(getNote).not.toHaveBeenCalled();
  });

  it("calls onClose from Close button and backdrop", async () => {
    getNote.mockResolvedValue(makeNoteDetail());
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <PostItDialog
        pin={makePin()}
        tab="mine"
        authToken="jwt"
        onClose={onClose}
      />
    );

    await screen.findByText("Secret body");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows an error when open fails", async () => {
    getNote.mockRejectedValue(new ApiError("Not found", 404));

    render(
      <PostItDialog
        pin={makePin()}
        tab="mine"
        authToken="jwt"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });
});
