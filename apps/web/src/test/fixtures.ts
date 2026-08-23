import type { BoardPin, NoteDetail, SharedNoteView } from "@note-share/shared";

export function makePin(overrides: Partial<BoardPin> = {}): BoardPin {
  return {
    id: "pin-1",
    title: "Hello cork",
    shareToken: "tok-1",
    shareType: "TIME_BASED",
    accessType: "PUBLIC",
    ownerName: "Ada",
    isOwner: true,
    viewCount: 0,
    expiresAt: null,
    revokedAt: null,
    usedAt: null,
    isExpired: false,
    isRevoked: false,
    isUsed: false,
    isAccessible: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

export function makeNoteDetail(
  overrides: Partial<NoteDetail> = {}
): NoteDetail {
  return {
    id: "pin-1",
    title: "Hello cork",
    content: "Secret body",
    shareType: "TIME_BASED",
    accessType: "PUBLIC",
    shareToken: "tok-1",
    shareUrl: "http://localhost:3000/share/tok-1",
    viewCount: 1,
    expiresAt: null,
    revokedAt: null,
    usedAt: null,
    isExpired: false,
    isRevoked: false,
    isUsed: false,
    isAccessible: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    allowedEmails: [],
    ...overrides,
  };
}

export function makeSharedView(
  overrides: Partial<SharedNoteView> = {}
): SharedNoteView {
  return {
    title: "Public pin",
    content: "Shared body",
    shareType: "TIME_BASED",
    accessType: "PUBLIC",
    viewCount: 3,
    expiresAt: null,
    ...overrides,
  };
}
