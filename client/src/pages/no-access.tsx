import { Link } from "wouter";
import { Home, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui-kit";
import { useAuth } from "@/hooks/use-auth";

/**
 * Shown in place of a screen the user's role does not open. Names the role so
 * the user knows what to ask the administrator for, rather than a bare 403.
 */
export default function NoAccess() {
  const { user } = useAuth();
  return (
    <div className="card-premium flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="icon-tile mb-5 h-16 w-16 rounded-2xl bg-amber-500/10">
        <ShieldAlert className="h-7 w-7 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
        Ruxsat yo'q
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Bu bo'lim sizning rolingiz uchun yopiq</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Har bir xodim faqat o'z vazifasiga tegishli bo'limlarni ko'radi. Bu bo'lim kerak bo'lsa,
        administratorga murojaat qiling.
      </p>
      {user && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          Sizning rolingiz:
          <RoleBadge role={user.role} name={user.roleName} />
        </div>
      )}
      <Button asChild className="mt-6">
        <Link href="/home">
          <Home className="mr-2 h-4 w-4" />
          Bosh sahifaga
        </Link>
      </Button>
    </div>
  );
}
