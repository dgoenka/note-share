import type {
  AuthResponse,
  BoardPage,
  CreateNoteInput,
  LoginInput,
  NoteDetail,
  PublicUser,
  RegisterInput,
  ShareStatus,
  SharedNoteView,
} from "@note-share/shared";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error || res.statusText || "Request failed",
      res.status
    );
  }
  return data as T;
}

export const api = {
  register: (body: RegisterInput) =>
    request<AuthResponse>("/auth/register", { method: "POST", body }),

  login: (body: LoginInput) =>
    request<AuthResponse>("/auth/login", { method: "POST", body }),

  me: (token: string) =>
    request<{ user: PublicUser }>("/auth/me", { token }),

  listNotes: (token: string) =>
    request<{ notes: NoteDetail[] }>("/notes", { token }),

  createNote: (token: string, body: CreateNoteInput) =>
    request<NoteDetail>("/notes", { method: "POST", body, token }),

  getNote: (token: string, id: string) =>
    request<NoteDetail>(`/notes/${id}`, { token }),

  revokeNote: (token: string, id: string) =>
    request<NoteDetail>(`/notes/${id}/revoke`, { method: "POST", token }),

  shareStatus: (shareToken: string, authToken?: string | null) =>
    request<ShareStatus>(`/share/${shareToken}`, {
      token: authToken ?? undefined,
    }),

  openShare: (shareToken: string, authToken?: string | null) =>
    request<SharedNoteView>(`/share/${shareToken}/open`, {
      method: "POST",
      token: authToken ?? undefined,
    }),

  unlockShare: (shareToken: string, password: string) =>
    request<SharedNoteView>(`/share/${shareToken}/unlock`, {
      method: "POST",
      body: { password },
    }),

  boardMine: (token: string, opts?: { cursor?: string | null; limit?: number }) => {
    const q = new URLSearchParams();
    if (opts?.cursor) q.set("cursor", opts.cursor);
    if (opts?.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return request<BoardPage>(`/board/mine${qs ? `?${qs}` : ""}`, { token });
  },

  boardFeed: (token: string, opts?: { cursor?: string | null; limit?: number }) => {
    const q = new URLSearchParams();
    if (opts?.cursor) q.set("cursor", opts.cursor);
    if (opts?.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return request<BoardPage>(`/board/feed${qs ? `?${qs}` : ""}`, { token });
  },
};
