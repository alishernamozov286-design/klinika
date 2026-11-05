import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { LoginInput, MfaChallenge, SessionUser } from "@shared/schema";
import { SUPER_ADMIN, type Permission } from "@shared/permissions";
import { SESSION_EXPIRED_EVENT, apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  /** Resolves with a challenge instead of a user when a 2FA code is still due. */
  login: (input: LoginInput) => Promise<SessionUser | MfaChallenge>;
  /** Second step of a 2FA sign-in: an app code or a recovery code. */
  verifyMfa: (code: string) => Promise<SessionUser>;
  /** `notice`, when given, is shown on the login screen afterwards. */
  logout: (notice?: string) => Promise<void>;
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

const NOTICE_KEY = "medlab.logoutNotice";

/**
 * A one-line explanation for the login screen of why the user is there
 * ("seans faolsizlik sababli yopildi"). sessionStorage, so it belongs to this
 * tab and disappears with it.
 */
export function setLogoutNotice(message: string) {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    /* storage unavailable — the login screen just says nothing */
  }
}

export function takeLogoutNotice(): string | null {
  try {
    const value = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return value;
  } catch {
    return null;
  }
}

/** Drops every trace of the signed-in user from this tab. */
function signOutLocally() {
  storeUser(null);
  queryClient.setQueryData(["/api/user"], null);
  queryClient.clear();
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

  const onSignedIn = (loggedIn: SessionUser) => {
    storeUser(loggedIn);
    queryClient.setQueryData(["/api/user"], loggedIn);
    toast({ title: `Xush kelibsiz, ${loggedIn.fullName}` });
  };

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiRequest("POST", "/api/login", input);
      return (await res.json()) as SessionUser | MfaChallenge;
    },
    onSuccess: (result) => {
      // A challenge is not a sign-in yet: nothing is stored until the code is right.
      if (!("mfaRequired" in result)) onSignedIn(result);
    },
  });

  const mfaMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/login/mfa", { code });
      return (await res.json()) as SessionUser;
    },
    onSuccess: onSignedIn,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    // Signed out locally even if the request fails: the server may already
    // have ended the session, and the user asked to leave either way.
    onSettled: () => {
      // Wipe every cached response — the next user must not see the last one's data.
      signOutLocally();
    },
  });

  useEffect(() => {
    /**
     * The server ended this session (idle, too old, revoked from another
     * device, account blocked). Any API call can be the one that finds out.
     */
    const onExpired = (e: Event) => {
      if (!queryClient.getQueryData(["/api/user"])) return;
      const message = (e as CustomEvent<{ message?: string }>).detail?.message;
      setLogoutNotice(message || "Seans yopildi. Qaytadan kiring.");
      signOutLocally();
    };
    /** Signing out in one tab signs out the others. */
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_KEY && e.newValue === null && queryClient.getQueryData(["/api/user"])) {
        queryClient.setQueryData(["/api/user"], null);
        queryClient.clear();
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    login: loginMutation.mutateAsync,
    verifyMfa: mfaMutation.mutateAsync,
    logout: async (notice?: string) => {
      if (notice) setLogoutNotice(notice);
      await logoutMutation.mutateAsync().catch(() => undefined);
    },
    isLoggingIn: loginMutation.isPending || mfaMutation.isPending,
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
