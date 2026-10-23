export interface Post {
  id: string;
  slug: string;
  title: string;
  date: string;
  description?: string;
  cover?: string;
  draft: boolean;
  series?: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MentionItem {
  id: string;
  slug: string;
  title: string;
  draft: boolean;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("未登录");
    this.name = "UnauthorizedError";
  }
}

let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 401 && path !== "/api/login") {
    onUnauthorized();
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    throw new Error(data?.error || res.statusText || "请求失败");
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; auth: boolean }>("/api/health"),
  session: () => request<{ ok: boolean }>("/api/session"),
  login: (username: string, password: string) =>
    request<{ ok: boolean }>("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/logout", { method: "POST" }),
  listPosts: () => request<Post[]>("/api/posts"),
  getPost: (id: string) => request<Post>(`/api/posts/${id}`),
  createPost: (body: unknown) =>
    request<Post>("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updatePost: (id: string, body: unknown) =>
    request<Post>(`/api/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deletePost: (id: string) =>
    request<{ ok: boolean }>(`/api/posts/${id}`, { method: "DELETE" }),
  mentions: (q: string) =>
    request<MentionItem[]>(`/api/posts/mentions?q=${encodeURIComponent(q)}`),
  tags: (q: string) =>
    request<Array<{ id: string; name: string }>>(`/api/tags?q=${encodeURIComponent(q)}`),
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ id: string; url: string; name: string }>("/api/files", {
      method: "POST",
      body: form,
    });
  },
  staticize: () =>
    request<{
      ok: boolean;
      written: string[];
      skippedImages: string[];
      skippedDrafts: string[];
      rebuilt: boolean;
    }>(
      "/api/staticize",
      { method: "POST" },
    ),
};
