import type {
  AuthResponse,
  BoardPage,
  CreateNoteInput,
  LoginInput,
  MediaUploadResponse,
  NoteDetail,
  PublicUser,
  RegisterInput,
  ShareStatus,
  SharedNoteView,
  StorageQuota,
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
    request<
      { user: PublicUser; noteCount: number } & StorageQuota
    >("/auth/me", { token }),

  uploadMedia: async (token: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/media/upload`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: form,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        (data as { error?: string }).error || res.statusText || "Upload failed",
        res.status
      );
    }
    return data as MediaUploadResponse;
  },

  signMedia: (token: string, ids: string[]) =>
    request<{ urls: Record<string, string> }>("/media/sign", {
      method: "POST",
      body: { ids },
      token,
    }),

  mediaQuota: (token: string) =>
    request<StorageQuota>("/media/quota", { token }),

  unfurlLink: (token: string, url: string) =>
    request<{
      url: string;
      title: string;
      description: string;
      image: string;
      siteName: string;
    }>("/links/unfurl", { method: "POST", body: { url }, token }),

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
