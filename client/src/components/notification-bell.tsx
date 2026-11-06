/**
 * The header bell (B3.9): the signed-in user's notices — for a doctor, the
 * lab results of the patients they referred, as soon as the lab head
 * verifies them. Polls until real-time updates arrive (B8.1).
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, CheckCheck, FlaskConical, PencilLine } from "lucide-react";
import type { AppNotification, NotificationFeed } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NOTIFICATIONS_KEY = "/api/notifications?limit=20";

export function useNotifications() {
  return useQuery<NotificationFeed>({
    queryKey: [NOTIFICATIONS_KEY],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
}

export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onMutate: (id) => {
      // Optimistic: the dot goes the moment it is clicked.
      queryClient.setQueryData<NotificationFeed>([NOTIFICATIONS_KEY], (old) =>
        old
          ? {
              unread: Math.max(0, old.unread - (old.items.some((n) => n.id === id && !n.readAt) ? 1 : 0)),
              items: old.items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
            }
          : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
  });
}

const ICONS = { lab_result: FlaskConical, lab_result_amended: PencilLine } as const;

export function NotificationBell() {
  const [, navigate] = useLocation();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          aria-label={unread ? `Bildirishnomalar: ${unread} ta yangi` : "Bildirishnomalar"}
          data-testid="button-notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold tabular text-white ring-2 ring-background"
              data-testid="badge-notifications-unread"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Bildirishnomalar</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.preventDefault();
                markAll.mutate();
              }}
              data-testid="button-notifications-read-all"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Hammasi o'qildi
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Yangi bildirishnoma yo'q</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {items.map((n) => {
              const Icon = ICONS[n.kind] ?? Bell;
              return (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={() => open(n)}
                  className={cn("flex cursor-pointer items-start gap-3 px-4 py-3", !n.readAt && "bg-primary/[0.04]")}
                  data-testid={`notification-${n.id}`}
                >
                  <div
                    className={cn(
                      "icon-tile mt-0.5 h-8 w-8 shrink-0",
                      n.important ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-snug", !n.readAt ? "font-semibold" : "font-medium text-muted-foreground")}>{n.title}</p>
                    {n.body && <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground line-clamp-3">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="O'qilmagan" />}
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
