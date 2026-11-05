import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { LoginInput, SessionUser } from "@shared/schema";
import { SUPER_ADMIN, type Permission } from "@shared/permissions";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<SessionUser>;
  logout: () => Promise<void>;
  isLoggingIn: boolean;
  /**
   * True when the user holds at least one of the given permissions — the
   * same "any of" rule as requirePermission() on the server. Hiding a control
   * is only a courtesy; the server enforces every one of these.
   */
  can: (...permissions: Permission[]) => boolean;
  isSuperAdmin: boolean;
};

const USER_KEY = "medlab.user";

/**
 * The last signed-in user, kept so a refresh can paint the app straight away
 * instead of a blank page while /api/user round-trips to a remote database.
 * It is only a hint: the query below always re-checks with the server and a
 * 401 clears it, so a stale entry cannot keep anyone signed in.
 */
function readStoredUser(): SessionUser | undefined {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : undefined;
  } catch {
    return undefined;
  }
}

function storeUser(user: SessionUser | null | undefined) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable — the app just loads the slow way */
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<SessionUser | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const fresh = await getQueryFn<SessionUser | null>({ on401: "returnNull" })({
        queryKey: ["/api/user"],
      } as never);
      storeUser(fresh);
      return fresh;
    },
    // Render from the stored user immediately, but mark it as already stale so
    // the first mount verifies it in the background.
    initialData: readStoredUser,
    initialDataUpdatedAt: 0,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
  });

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiRequest("POST", "/api/login", input);
      return (await res.json()) as SessionUser;
    },
    onSuccess: (loggedIn) => {
      storeUser(loggedIn);
      queryClient.setQueryData(["/api/user"], loggedIn);
      toast({ title: `Xush kelibsiz, ${loggedIn.fullName}` });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Wipe every cached response — the next user must not see the last one's data.
      storeUser(null);
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();
    },
  });

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    login: loginMutation.mutateAsync,
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    isLoggingIn: loginMutation.isPending,
    can: (...permissions) => {
      const held = user?.permissions;
      // A user cached before RBAC has no permission list; treat it as none
      // until /api/user answers rather than guessing.
      if (!held) return false;
      return permissions.some((p) => held.includes(p));
    },
    isSuperAdmin: user?.role === SUPER_ADMIN,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
