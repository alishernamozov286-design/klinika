import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * A failed API call. `message` is the server's own Uzbek sentence, ready for
 * a toast; `status` and `body` are there for callers that need more (the login
 * screen reads lock details from the body).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fired on any 401 from an authenticated call; AuthProvider signs the tab out. */
export const SESSION_EXPIRED_EVENT = "medlab:session-expired";

/** Paths whose 401 means "wrong password" or "not signed in yet", not "session ended". */
const AUTH_PATHS = ["/api/login", "/api/user"];

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const message =
    typeof body?.message === "string" ? body.message : text || res.statusText || `Xatolik (${res.status})`;

  if (res.status === 401 && !AUTH_PATHS.some((p) => new URL(res.url, location.origin).pathname === p)) {
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { code: body?.code ?? null, message } }),
    );
  }
  throw new ApiError(res.status, message, body);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours cache retention
      retry: false,
      networkMode: "offlineFirst", // Use cache first, network second
    },
    mutations: {
      retry: false,
      networkMode: "online",
    },
  },
});

/**
 * A query key *is* the request URL, so once lists carry filters the key becomes
 * "/api/orders?status=pending&limit=25&offset=0" and the plain key
 * ["/api/orders"] no longer matches it. Invalidate by URL prefix instead —
 * one call covers every page, filter and sub-resource of a collection.
 */
export function invalidateApi(...prefixes: string[]): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const url = String(query.queryKey[0] ?? "");
      return prefixes.some((p) => url === p || url.startsWith(`${p}?`) || url.startsWith(`${p}/`));
    },
  });
}
